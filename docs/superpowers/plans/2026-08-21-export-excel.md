# Export a Excel (Asistencia, Horas, RRHH) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Agregar exportación a `.xlsx` de los tres reportes existentes en el panel (Asistencia, Horas, RRHH) mediante un botón "Descargar Excel" en cada página, que respeta los filtros activos en pantalla. Sin lógica de negocio nueva — envuelve datos que ya devuelven funciones existentes.

**Architecture:** `server/` gana un helper genérico `lib/excel.ts` (arma un `ExcelJS.Workbook` multi-hoja y lo manda como adjunto) y 3 rutas `GET .../export` nuevas (una por reporte, cada una en su archivo de rutas existente). `web/` gana un helper de descarga autenticada compartido (mismo patrón que `useQrBlob.ts`, pero disparado por click en vez de por mount) y un botón "Descargar Excel" en cada una de las 3 páginas.

**Tech Stack:** `exceljs@4.4.0` (nueva dependencia de `server/`, generación del lado del servidor). Sin dependencias nuevas en `web/`.

**Spec:** `docs/superpowers/specs/2026-08-21-export-excel-design.md`

## Global Constraints

- **Sin tests automatizados** (convención del repo, `server/package.json` → `"test": "echo \"Sin tests automatizados...\""`) — verificación vía `typecheck`/`build` por task, `curl` contra el server corriendo para las rutas, y checklist manual en navegador al final.
- **Disparador**: botón "Descargar Excel" en la barra de filtros de cada página (Asistencia, Horas, RRHH) — no una página de "Exportes" centralizada.
- **El archivo respeta los filtros activos en pantalla**: rango de fechas siempre; en RRHH también sucursal/motivo si están filtrados (Asistencia y Horas no tienen esos filtros en su UI hoy, así que sus rutas de export solo toman `desde`/`hasta`).
- **Multi-hoja**: Asistencia (`Registros` + `Rechazadas`) y Horas (`Resumen` + `Turnos`) generan un solo `.xlsx` con 2 hojas cada uno. RRHH genera 1 hoja (`Ausencias`).
- **RRHH incluye `detalle` y `contacto`** en el export aunque la tabla en pantalla no las muestre.
- **Sin filas → archivo igual, hoja vacía** (headers en negrita nomás), no es un error.
- **Nombre de archivo**: `<reporte>_<desde>_<hasta>.xlsx`. El export de RRHH usa `rrhh` como `<reporte>` (coincide con el nombre de página/spec), aunque la ruta HTTP sea `/api/ausencias/export` (coincide con el resto de la API de ese módulo).
- **Fuera de alcance**: estilos/formato visual más allá de headers en negrita y ancho de columna razonable; envíos automáticos/programados.
- **Supabase de este proyecto es un proyecto remoto real** (no Docker local) — si hiciera falta tocar la DB no se usa `psql` ni `supabase db reset`. Este plan no toca la DB (sin migraciones).
- **Worktree**: este plan se ejecuta en `.worktrees/pendientes-y-mejoras` (rama `pendientes-y-mejoras`, creada desde `main` local, commit `61397e6`). El repo principal (`/Users/tomasocampo/Documents/personal/proyecto-oliver`) tiene **otra sesión activa en paralelo** (Kimi Code, trabajando WIP de tiers/planes) — no correr ningún comando `git` fuera de este worktree, y no tocar los archivos sin commitear del repo principal.
- **Puertos de este worktree**: `server` en `3021`, `web` en `5181` (verificados libres y ya configurados en `server/.env.local` / `web/.env.local` de este worktree — `CORS_ORIGIN`/`VITE_API_URL` ya apuntan entre sí). Node modules ya instalados (`npm install` corrido en `server/` y `web/`). Si algún puerto deja de estar libre al ejecutar este plan, verificar con `lsof -iTCP -sTCP:LISTEN -P` y ajustar.
- **Login de prueba para verificación manual**: `demo@test.local` / `demo123456` (cuenta demo ya sembrada en el proyecto Supabase remoto, usada en planes anteriores).

---

## Task 1: Helper de Excel + `GET /api/asistencia/export`

**Files:**
- Modify: `server/package.json` (agrega dependencia `exceljs`)
- Create: `server/src/lib/excel.ts`
- Modify: `server/src/routes/asistencia.ts`

**Interfaces:**
- Consumes: `listAsistencia(orgId, filters)`, `listRechazadas(orgId)`, `MotivoRechazo` (todos ya existen en `server/src/lib/asistencia.ts`); `requireAuth`/`requireOrg` (`server/src/plugins/*.js`).
- Produces: `HojaExcel` (interface), `generarExcel(hojas: HojaExcel[]): Promise<Buffer>`, `enviarExcel(reply: FastifyReply, buffer: Buffer, filename: string): void` — desde `server/src/lib/excel.ts`, consumidos por Task 2 y Task 3.

- [ ] **Step 1: Instalar `exceljs`**

```bash
cd server && npm install exceljs@4.4.0
```

Esperado: `server/package.json` y `server/package-lock.json` (o el lockfile que use el repo) muestran `exceljs` en `dependencies`.

- [ ] **Step 2: Crear `server/src/lib/excel.ts`**

```ts
import ExcelJS from "exceljs";
import type { FastifyReply } from "fastify";

export interface HojaExcel {
  nombre: string;
  columnas: { header: string; key: string; width?: number }[];
  filas: Record<string, unknown>[];
}

export async function generarExcel(hojas: HojaExcel[]): Promise<Buffer> {
  const workbook = new ExcelJS.Workbook();
  for (const hoja of hojas) {
    const sheet = workbook.addWorksheet(hoja.nombre);
    sheet.columns = hoja.columnas.map((c) => ({ header: c.header, key: c.key, width: c.width ?? 22 }));
    sheet.getRow(1).font = { bold: true };
    sheet.addRows(hoja.filas);
  }
  return Buffer.from(await workbook.xlsx.writeBuffer());
}

export function enviarExcel(reply: FastifyReply, buffer: Buffer, filename: string): void {
  reply.header("Content-Type", "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet");
  reply.header("Content-Disposition", `attachment; filename="${filename}"`);
  reply.send(buffer);
}
```

- [ ] **Step 3: Agregar la ruta de export en `server/src/routes/asistencia.ts`**

Reemplazar las líneas 1-16 (imports + `AR_TZ` + `hoyAR`) por el siguiente bloque — agrega `type MotivoRechazo` al import existente, agrega el import de `excel.js`, mantiene `AR_TZ`/`hoyAR` tal cual estaban, y suma `fechaHoraAR` + `MOTIVOS` nuevas. El resto del archivo (interfaces `ListQuery`/`IdParams`/`ResolverQuery` y la función `asistenciaRoutes`) no se toca en este step:

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
  type MotivoRechazo,
} from "../lib/asistencia.js";
import { generarExcel, enviarExcel } from "../lib/excel.js";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function fechaHoraAR(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
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
```

Al final de `asistenciaRoutes`, antes del `}` que cierra la función, agregar:

```ts
  interface ExportQuery {
    desde?: string;
    hasta?: string;
  }

  app.get<{ Querystring: ExportQuery }>(
    "/api/asistencia/export",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const desde = request.query.desde || hoyAR();
      const hasta = request.query.hasta || hoyAR();

      const [registros, rechazadas] = await Promise.all([
        listAsistencia(request.org!.id, { desde, hasta }),
        listRechazadas(request.org!.id),
      ]);

      const buffer = await generarExcel([
        {
          nombre: "Registros",
          columnas: [
            { header: "Fecha y hora", key: "fecha", width: 20 },
            { header: "Empleado", key: "empleado", width: 26 },
            { header: "Sucursal", key: "sucursal", width: 22 },
            { header: "Tipo", key: "tipo", width: 12 },
          ],
          filas: registros.map((r) => ({
            fecha: fechaHoraAR(r.created_at),
            empleado: r.empleado_nombre ?? "—",
            sucursal: r.sucursal_nombre ?? "—",
            tipo: r.tipo === "entrada" ? "Entrada" : "Salida",
          })),
        },
        {
          nombre: "Rechazadas",
          columnas: [
            { header: "Fecha", key: "fecha", width: 20 },
            { header: "Empleado", key: "empleado", width: 26 },
            { header: "Sucursal", key: "sucursal", width: 22 },
            { header: "Tipo", key: "tipo", width: 12 },
            { header: "Motivo", key: "motivo", width: 32 },
            { header: "Distancia (m)", key: "distancia", width: 14 },
            { header: "Resuelto", key: "resuelto", width: 12 },
          ],
          filas: rechazadas.map((r) => ({
            fecha: fechaHoraAR(r.created_at),
            empleado: r.empleado_nombre ?? "—",
            sucursal: r.sucursal_nombre ?? "—",
            tipo: r.tipo === "entrada" ? "Entrada" : r.tipo === "salida" ? "Salida" : "—",
            motivo: MOTIVOS[r.motivo] ?? r.motivo,
            distancia: r.distancia_metros ?? "—",
            resuelto: r.resuelto ? "Sí" : "No",
          })),
        },
      ]);

      enviarExcel(reply, buffer, `asistencia_${desde}_${hasta}.xlsx`);
    }
  );
```

- [ ] **Step 4: Verificar que compila**

```bash
cd server && npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 5: Verificar manualmente contra el server corriendo**

En una terminal: `cd server && npm run dev` (puerto `3021`). En otra:

```bash
source <(grep -E "^SUPABASE_URL|^SUPABASE_ANON_KEY" server/.env.local | sed 's/^/export /')
SESSION=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"demo123456"}')
TOKEN=$(echo "$SESSION" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).access_token))')

curl -s -D - -o /tmp/asistencia.xlsx "http://localhost:3021/api/asistencia/export?desde=2026-08-01&hasta=2026-08-21" \
  -H "Authorization: Bearer $TOKEN" | grep -i "content-type\|content-disposition\|HTTP/"

file /tmp/asistencia.xlsx
unzip -l /tmp/asistencia.xlsx | grep -i sheet
```

Esperado: `HTTP/1.1 200 OK`, `Content-Type: application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`, `Content-Disposition: attachment; filename="asistencia_2026-08-01_2026-08-21.xlsx"`; `file` reporta `Microsoft Excel 2007+` (o `Zip archive data`); `unzip -l` lista `xl/worksheets/sheet1.xml` y `sheet2.xml` (2 hojas).

- [ ] **Step 6: Commit**

```bash
git add server/package.json server/package-lock.json server/src/lib/excel.ts server/src/routes/asistencia.ts
git commit -m "feat(server): export a Excel de Asistencia"
```

---

## Task 2: `GET /api/horas/export`

**Files:**
- Modify: `server/src/lib/asistencia.ts` (agrega `ResumenEmpleado` + `calcularResumenHoras`, extraídos del cálculo que hoy vive inline en la ruta)
- Modify: `server/src/routes/horas.ts`

**Interfaces:**
- Consumes: `calcularHoras(orgId, filters)`, `Turno` (`server/src/lib/asistencia.ts`, ya existen); `generarExcel`, `enviarExcel` (`server/src/lib/excel.ts`, Task 1).
- Produces: `ResumenEmpleado` (interface), `calcularResumenHoras(turnos: Turno[]): ResumenEmpleado[]` — desde `server/src/lib/asistencia.ts`, reemplaza el cálculo inline que hoy usa `/api/horas` y es reusado por `/api/horas/export`.

- [ ] **Step 1: Agregar al final de `server/src/lib/asistencia.ts`**

```ts

export interface ResumenEmpleado {
  nombre: string;
  totalHoras: number;
  enCurso: boolean;
}

export function calcularResumenHoras(turnos: Turno[]): ResumenEmpleado[] {
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
  return Array.from(porEmpleado.values()).sort((a, b) => a.nombre.localeCompare(b.nombre));
}
```

- [ ] **Step 2: Reescribir `server/src/routes/horas.ts` completo**

```ts
import type { FastifyInstance } from "fastify";
import { requireAuth } from "../plugins/auth.js";
import { requireOrg } from "../plugins/require-org.js";
import { calcularHoras, calcularResumenHoras } from "../lib/asistencia.js";
import { generarExcel, enviarExcel } from "../lib/excel.js";

const AR_TZ = "America/Argentina/Buenos_Aires";

function hoyAR(): string {
  return new Date().toLocaleDateString("sv", { timeZone: AR_TZ });
}

function inicioDeMesAR(): string {
  return `${hoyAR().slice(0, 7)}-01`;
}

function fechaHoraAR(iso: string): string {
  return new Date(iso).toLocaleString("es-AR", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    timeZone: AR_TZ,
  });
}

interface HorasQuery {
  desde?: string;
  hasta?: string;
  sucursalId?: string;
}

export async function horasRoutes(app: FastifyInstance): Promise<void> {
  app.get<{ Querystring: HorasQuery }>(
    "/api/horas",
    { preHandler: [requireAuth, requireOrg] },
    async (request) => {
      const { sucursalId } = request.query;
      const desde = request.query.desde || inicioDeMesAR();
      const hasta = request.query.hasta || hoyAR();

      const turnos = await calcularHoras(request.org!.id, { desde, hasta, sucursalId });
      const resumen = calcularResumenHoras(turnos);

      return { desde, hasta, turnos, resumen };
    }
  );

  app.get<{ Querystring: HorasQuery }>(
    "/api/horas/export",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const desde = request.query.desde || inicioDeMesAR();
      const hasta = request.query.hasta || hoyAR();

      const turnos = await calcularHoras(request.org!.id, { desde, hasta });
      const resumen = calcularResumenHoras(turnos);

      const buffer = await generarExcel([
        {
          nombre: "Resumen",
          columnas: [
            { header: "Empleado", key: "empleado", width: 26 },
            { header: "Total horas", key: "total", width: 14 },
            { header: "Estado", key: "estado", width: 18 },
          ],
          filas: resumen.map((r) => ({
            empleado: r.nombre,
            total: r.totalHoras,
            estado: r.enCurso ? "Turno en curso" : "—",
          })),
        },
        {
          nombre: "Turnos",
          columnas: [
            { header: "Empleado", key: "empleado", width: 26 },
            { header: "Sucursal", key: "sucursal", width: 22 },
            { header: "Entrada", key: "entrada", width: 20 },
            { header: "Salida", key: "salida", width: 20 },
            { header: "Horas", key: "horas", width: 12 },
          ],
          filas: turnos.map((t) => ({
            empleado: t.nombre,
            sucursal: t.sucursal_nombre,
            entrada: fechaHoraAR(t.entrada_at),
            salida: t.salida_at ? fechaHoraAR(t.salida_at) : "En curso",
            horas: t.horas ?? "—",
          })),
        },
      ]);

      enviarExcel(reply, buffer, `horas_${desde}_${hasta}.xlsx`);
    }
  );
}
```

- [ ] **Step 3: Verificar que compila**

```bash
cd server && npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 4: Verificar manualmente contra el server corriendo**

Con `server` corriendo en `3021` (reiniciar si `npm run dev` no hace watch de este cambio — `tsx watch` sí lo hace, no debería hacer falta):

```bash
source <(grep -E "^SUPABASE_URL|^SUPABASE_ANON_KEY" server/.env.local | sed 's/^/export /')
SESSION=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"demo123456"}')
TOKEN=$(echo "$SESSION" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).access_token))')

echo "--- /api/horas sigue devolviendo el mismo shape que antes ---"
curl -s "http://localhost:3021/api/horas?desde=2026-08-01&hasta=2026-08-21" -H "Authorization: Bearer $TOKEN"
echo

curl -s -D - -o /tmp/horas.xlsx "http://localhost:3021/api/horas/export?desde=2026-08-01&hasta=2026-08-21" \
  -H "Authorization: Bearer $TOKEN" | grep -i "content-type\|content-disposition\|HTTP/"

file /tmp/horas.xlsx
unzip -l /tmp/horas.xlsx | grep -i sheet
```

Esperado: `/api/horas` sigue devolviendo `{desde, hasta, turnos, resumen}` con el mismo contenido que antes de este task (mismo cálculo, ahora extraído a `calcularResumenHoras`); el export da `[200]`, headers correctos, `.xlsx` válido con 2 hojas.

- [ ] **Step 5: Commit**

```bash
git add server/src/lib/asistencia.ts server/src/routes/horas.ts
git commit -m "feat(server): export a Excel de Horas, extrae calcularResumenHoras"
```

---

## Task 3: `GET /api/ausencias/export`

**Files:**
- Modify: `server/src/routes/rrhh.ts`

**Interfaces:**
- Consumes: `listAusencias(orgId, filters?)` (`server/src/lib/rrhh.ts`, ya existe); `generarExcel`, `enviarExcel` (`server/src/lib/excel.ts`, Task 1).
- Produces: ninguna nueva (ruta hoja, sin exports de tipos/funciones consumidos por otras tasks).

- [ ] **Step 1: Agregar el import de excel al inicio de `server/src/routes/rrhh.ts`**

```ts
import { generarExcel, enviarExcel } from "../lib/excel.js";
```

(agregar debajo del resto de imports existentes, no reemplazarlos)

- [ ] **Step 2: Agregar la ruta al final de `rrhhRoutes`, antes del `}` que cierra la función**

`ListQuery` ya tiene `desde`, `hasta`, `sucursalId`, `motivo`, `empleadoId` — se reusa tal cual, son los mismos filtros que usa `RrhhPage`.

```ts
  app.get<{ Querystring: ListQuery }>(
    "/api/ausencias/export",
    { preHandler: [requireAuth, requireOrg] },
    async (request, reply) => {
      const ausencias = await listAusencias(request.org!.id, request.query);

      const buffer = await generarExcel([
        {
          nombre: "Ausencias",
          columnas: [
            { header: "Empleado", key: "empleado", width: 26 },
            { header: "Sucursal", key: "sucursal", width: 22 },
            { header: "Fecha desde", key: "desde", width: 14 },
            { header: "Fecha hasta", key: "hasta", width: 14 },
            { header: "Motivo", key: "motivo", width: 24 },
            { header: "Certificado pendiente", key: "certificado", width: 20 },
            { header: "Detalle", key: "detalle", width: 32 },
            { header: "Contacto", key: "contacto", width: 22 },
          ],
          filas: ausencias.map((a) => ({
            empleado: a.empleado_nombre,
            sucursal: a.sucursal_nombre ?? "—",
            desde: a.fecha_desde,
            hasta: a.fecha_hasta,
            motivo: a.motivo,
            certificado: a.certificado_pendiente ? "Sí" : "No",
            detalle: a.detalle ?? "",
            contacto: a.contacto ?? "",
          })),
        },
      ]);

      const desde = request.query.desde ?? "todas";
      const hasta = request.query.hasta ?? "todas";
      enviarExcel(reply, buffer, `rrhh_${desde}_${hasta}.xlsx`);
    }
  );
```

- [ ] **Step 3: Verificar que compila**

```bash
cd server && npm run typecheck
```

Esperado: sin errores.

- [ ] **Step 4: Verificar manualmente contra el server corriendo**

```bash
source <(grep -E "^SUPABASE_URL|^SUPABASE_ANON_KEY" server/.env.local | sed 's/^/export /')
SESSION=$(curl -s -X POST "$SUPABASE_URL/auth/v1/token?grant_type=password" \
  -H "apikey: $SUPABASE_ANON_KEY" -H "Content-Type: application/json" \
  -d '{"email":"demo@test.local","password":"demo123456"}')
TOKEN=$(echo "$SESSION" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>console.log(JSON.parse(d).access_token))')

curl -s -D - -o /tmp/rrhh.xlsx "http://localhost:3021/api/ausencias/export?desde=2026-08-01&hasta=2026-08-21" \
  -H "Authorization: Bearer $TOKEN" | grep -i "content-type\|content-disposition\|HTTP/"

file /tmp/rrhh.xlsx
unzip -l /tmp/rrhh.xlsx | grep -i sheet
```

Esperado: `[200]`, headers correctos con `filename="rrhh_2026-08-01_2026-08-21.xlsx"`, `.xlsx` válido con 1 hoja.

- [ ] **Step 5: Commit**

```bash
git add server/src/routes/rrhh.ts
git commit -m "feat(server): export a Excel de RRHH"
```

---

## Task 4: Helper de descarga + botón "Descargar Excel" en Asistencia

**Files:**
- Create: `web/src/lib/descargarArchivo.ts`
- Modify: `web/src/lib/api.ts`
- Modify: `web/src/pages/asistencia/AsistenciaPage.tsx`

**Interfaces:**
- Consumes: `supabase` (`web/src/lib/supabase.ts`, ya existe, mismo patrón que `useQrBlob.ts`); `/api/asistencia/export` (Task 1).
- Produces: `descargarArchivo(path: string, filename: string): Promise<void>` (`web/src/lib/descargarArchivo.ts`) — consumido por Task 5 y Task 6; `exportarAsistencia(desde: string, hasta: string): Promise<void>`, `exportarHoras(desde: string, hasta: string): Promise<void>`, `exportarAusencias(filters): Promise<void>` (`web/src/lib/api.ts`) — las dos últimas consumidas por Task 5 y Task 6.

- [ ] **Step 1: Crear `web/src/lib/descargarArchivo.ts`**

```ts
import { supabase } from "./supabase";

const API_URL = import.meta.env.VITE_API_URL ?? "http://localhost:3001";

/**
 * Pide un archivo mandando el Bearer token (un <a href="..."> directo no
 * puede mandar headers) y dispara la descarga del blob resultante. Mismo
 * patrón que useQrBlob.ts, pero on-demand (por click) en vez de por mount.
 */
export async function descargarArchivo(path: string, filename: string): Promise<void> {
  const {
    data: { session },
  } = await supabase.auth.getSession();
  if (!session) throw new Error("No se pudo descargar el archivo.");

  const res = await fetch(`${API_URL}${path}`, {
    headers: { Authorization: `Bearer ${session.access_token}` },
  });
  if (!res.ok) throw new Error("No se pudo descargar el archivo.");

  const blob = await res.blob();
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  URL.revokeObjectURL(url);
}
```

- [ ] **Step 2: Agregar al final de `web/src/lib/api.ts`**

Agregar el import al inicio del archivo, junto al de `supabase`:

```ts
import { descargarArchivo } from "./descargarArchivo";
```

Y al final del archivo:

```ts

export function exportarAsistencia(desde: string, hasta: string): Promise<void> {
  return descargarArchivo(`/api/asistencia/export?desde=${desde}&hasta=${hasta}`, `asistencia_${desde}_${hasta}.xlsx`);
}

export function exportarHoras(desde: string, hasta: string): Promise<void> {
  return descargarArchivo(`/api/horas/export?desde=${desde}&hasta=${hasta}`, `horas_${desde}_${hasta}.xlsx`);
}

export interface ExportarAusenciasFilters {
  desde: string;
  hasta: string;
  sucursalId?: string;
  motivo?: string;
}

export function exportarAusencias(filters: ExportarAusenciasFilters): Promise<void> {
  const params = new URLSearchParams({ desde: filters.desde, hasta: filters.hasta });
  if (filters.sucursalId) params.set("sucursalId", filters.sucursalId);
  if (filters.motivo) params.set("motivo", filters.motivo);
  return descargarArchivo(`/api/ausencias/export?${params}`, `rrhh_${filters.desde}_${filters.hasta}.xlsx`);
}
```

- [ ] **Step 3: Editar `web/src/pages/asistencia/AsistenciaPage.tsx`**

Agregar `Download` al import de `lucide-react` (línea 2):

```ts
import { LogIn, LogOut, Download } from "lucide-react";
```

Agregar el import de `exportarAsistencia` junto al de `useAsistencia` (línea 8):

```ts
import { useAsistencia, useRechazadas, useBorrarAsistencia, useResolverRechazada } from "./hooks";
import { exportarAsistencia } from "../../lib/api";
```

Agregar estado y handler dentro de `AsistenciaPage`, después de `const [error, setError] = useState<string | null>(null);` (línea 39):

```ts
  const [descargando, setDescargando] = useState(false);

  async function handleDescargarExcel() {
    setError(null);
    setDescargando(true);
    try {
      await exportarAsistencia(desde, hasta);
    } catch {
      setError("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }
```

En la sección de filtros (línea 112-128), agregar el botón junto a los `Field` de fecha:

```tsx
      <section className="mt-6">
        <div className="flex flex-wrap items-end gap-4">
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
          <Button variant="secondary" className="ml-auto" onClick={handleDescargarExcel} disabled={descargando}>
            <Download className="h-4 w-4" />
            {descargando ? "Generando…" : "Descargar Excel"}
          </Button>
        </div>
```

(el resto de la sección, desde `{error && ...}` en adelante, queda igual)

- [ ] **Step 4: Verificar que compila**

```bash
cd web && npm run build
```

Esperado: sin errores.

- [ ] **Step 5: Commit**

```bash
git add web/src/lib/descargarArchivo.ts web/src/lib/api.ts web/src/pages/asistencia/AsistenciaPage.tsx
git commit -m "feat(web): botón Descargar Excel en Asistencia"
```

---

## Task 5: Botón "Descargar Excel" en Horas

**Files:**
- Modify: `web/src/pages/horas/HorasPage.tsx`

**Interfaces:**
- Consumes: `exportarHoras(desde, hasta)` (`web/src/lib/api.ts`, Task 4).

- [ ] **Step 1: Editar `web/src/pages/horas/HorasPage.tsx`**

Reemplazar el bloque de imports (líneas 1-5) por:

```ts
import { useState } from "react";
import { Download } from "lucide-react";
import { Button } from "../../components/ui/button";
import { Field } from "../../components/ui/field";
import { Status } from "../../components/ui/status";
import { Table, TableHeader, TableBody, TableRow, TableHead, TableCell, TableSkeleton } from "../../components/ui/table";
import { useHoras } from "./hooks";
import { exportarHoras } from "../../lib/api";
```

Agregar estado y handler dentro de `HorasPage`, después de `const { data, isLoading, isError } = useHoras(desde, hasta);` (línea 31):

```ts
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);

  async function handleDescargarExcel() {
    setErrorDescarga(null);
    setDescargando(true);
    try {
      await exportarHoras(desde, hasta);
    } catch {
      setErrorDescarga("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }
```

Reemplazar el bloque de filtros (líneas 39-54) por:

```tsx
      <div className="mt-4 flex flex-wrap items-end gap-4">
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
        <Button variant="secondary" className="ml-auto" onClick={handleDescargarExcel} disabled={descargando}>
          <Download className="h-4 w-4" />
          {descargando ? "Generando…" : "Descargar Excel"}
        </Button>
      </div>

      {errorDescarga && <p className="mt-2 text-[15px] text-accent-700">{errorDescarga}</p>}
```

(el resto de la página, desde `{isError && ...}` en adelante, queda igual)

- [ ] **Step 2: Verificar que compila**

```bash
cd web && npm run build
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/horas/HorasPage.tsx
git commit -m "feat(web): botón Descargar Excel en Horas"
```

---

## Task 6: Botón "Descargar Excel" en RRHH

**Files:**
- Modify: `web/src/pages/rrhh/RrhhPage.tsx`

**Interfaces:**
- Consumes: `exportarAusencias(filters)` (`web/src/lib/api.ts`, Task 4).

- [ ] **Step 1: Editar `web/src/pages/rrhh/RrhhPage.tsx`**

Agregar `Download` al import de `lucide-react` (línea 2):

```ts
import { Plus, Pencil, Trash2, Download } from "lucide-react";
```

Agregar el import de `exportarAusencias` junto a los hooks (línea 13):

```ts
import { useAusencias, useCrearAusencia, useEditarAusencia, useBorrarAusencia, useRrhhCategorias, useGuardarCategorias } from "./hooks";
import { exportarAusencias } from "../../lib/api";
```

Agregar estado y handler dentro de `RrhhPage`, después de `const [motivoFiltro, setMotivoFiltro] = useState("");` (línea 71):

```ts
  const [descargando, setDescargando] = useState(false);
  const [errorDescarga, setErrorDescarga] = useState<string | null>(null);

  async function handleDescargarExcel() {
    setErrorDescarga(null);
    setDescargando(true);
    try {
      await exportarAusencias({
        desde,
        hasta,
        sucursalId: sucursalFiltro || undefined,
        motivo: motivoFiltro || undefined,
      });
    } catch {
      setErrorDescarga("No se pudo descargar el archivo.");
    } finally {
      setDescargando(false);
    }
  }
```

En la barra de filtros (líneas 214-235), agregar el botón antes de "Nueva ausencia" (ambos quedan agrupados a la derecha):

```tsx
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
        <div className="ml-auto flex gap-2">
          <Button variant="secondary" onClick={handleDescargarExcel} disabled={descargando}>
            <Download className="h-4 w-4" />
            {descargando ? "Generando…" : "Descargar Excel"}
          </Button>
          <Button variant="primary" onClick={() => setAltaOpen(true)}>
            <Plus className="h-4 w-4" />
            Nueva ausencia
          </Button>
        </div>
      </div>

      {errorDescarga && <p className="mt-2 text-[15px] text-accent-700">{errorDescarga}</p>}
```

(el `<Button variant="primary" className="ml-auto" onClick={() => setAltaOpen(true)}>` original se reemplaza por el de arriba, sin `className="ml-auto"` porque ahora ese margen lo aplica el `div` contenedor. El `{error && ...}` que ya existía después de este bloque, más todo lo que sigue — tabla, dialogs de alta/edición — queda igual, `{errorDescarga && ...}` se agrega como línea nueva antes de él.)

- [ ] **Step 2: Verificar que compila**

```bash
cd web && npm run build
```

Esperado: sin errores.

- [ ] **Step 3: Commit**

```bash
git add web/src/pages/rrhh/RrhhPage.tsx
git commit -m "feat(web): botón Descargar Excel en RRHH"
```

---

## Task 7: Verificación E2E

**Files:** ninguno — es la tarea de cierre, sin cambios de código.

**Interfaces:** ninguna.

- [ ] **Step 1: Confirmar que `server` y `web` corren**

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:3021/api/org/current
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:5181/
```

Si alguno no responde: `cd server && npm run dev` (puerto `3021` ya en `.env.local`), `cd web && npx vite --port 5181`.

- [ ] **Step 2: Checklist manual (para el usuario en el navegador)**

1. Entrar a `http://localhost:5181/asistencia` logueado (`demo@test.local`) — click en "Descargar Excel": confirmar que el botón muestra "Generando…" brevemente y se descarga un archivo `asistencia_<desde>_<hasta>.xlsx`. Abrirlo — confirmar 2 hojas ("Registros", "Rechazadas"), headers en negrita, datos coherentes con lo que se ve en pantalla.
2. Cambiar el rango de fechas en Asistencia y volver a descargar — confirmar que el nombre del archivo y el contenido de "Registros" cambian según el nuevo rango ("Rechazadas" no cambia, no tiene filtro de fecha).
3. Entrar a `/horas`, click en "Descargar Excel" — confirmar 2 hojas ("Resumen", "Turnos") con los mismos datos que la tabla en pantalla.
4. Entrar a `/rrhh`, sin filtros, click en "Descargar Excel" — confirmar 1 hoja ("Ausencias") con todas las columnas incluyendo `Detalle` y `Contacto` (aunque la tabla en pantalla no las muestre).
5. En `/rrhh`, filtrar por una sucursal y/o un motivo específico, descargar de nuevo — confirmar que el Excel solo trae las ausencias que matchean ese filtro.
6. Probar con un rango sin datos (ej. un mes futuro sin registros) en cualquiera de las 3 páginas — confirmar que igual se descarga un archivo válido, con la hoja vacía (solo headers), sin error en pantalla.
7. Confirmar que el resto del panel (`/`, `/sucursales`, `/empleados`, `/asistencia` sin exportar, `/horas` sin exportar, `/turnos`, `/rrhh` sin exportar) sigue funcionando sin cambios — en particular que `/horas` sigue mostrando el mismo resumen que antes de este plan (verifica que la extracción de `calcularResumenHoras` en la Task 2 no rompió nada).

Esperar la confirmación explícita del usuario antes de dar la etapa por cerrada.

- [ ] **Step 3: Push de la rama (si el usuario lo pide)**

No hacer push por defecto — preguntar antes de correr `git push`.
