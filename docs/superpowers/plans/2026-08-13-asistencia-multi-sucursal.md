# Plan 2 (reordenado): Módulo de Asistencia multi-sucursal

**Spec:** `docs/superpowers/specs/2026-08-12-whatsapp-saas-platform-design.md` (§4, §6, §12)

**Goal:** Que un cliente (una pyme) pueda darse de alta como organización,
cargar sus sucursales y empleados desde el dashboard, imprimir un QR por
sucursal, y que cada empleado marque **entrada y salida** desde su teléfono
con validación de identidad (vínculo dispositivo↔empleado con OTP) y de
ubicación (geocerca). Sin depender de WhatsApp ni de Meta.

**Decisiones tomadas con el usuario:**
- Se adelanta Asistencia (era Plan 3 en el spec) y pasa a ser el próximo plan.
  El canal de WhatsApp Cloud API queda para el plan siguiente (su diseño ya
  está pensado: Embedded Signup + webhook + dashboard de conversaciones, sin
  IA al principio).
- El OTP de vinculación se entrega **mostrándolo al admin en el dashboard**
  (el admin se lo pasa al empleado en persona). La máquina de OTP (tabla,
  expiración, intentos) queda igual que en el spec — cuando exista el canal
  de WhatsApp solo cambia el medio de entrega.
- IA diferida (no es de este plan de todos modos).

**Código reutilizable del sistema viejo** (en git history, commit `bf39781`):
- Matching de nombres exacto/subset/aproximado: `bf39781:src/lib/db.ts` líneas
  ~510–640 (`validarEmpleadoDB`, `buscarEmpleadoParecido`, `normalizeNombre`,
  `levenshtein`, `subsetParecido`, `umbralPalabra`).
- Fórmula Haversine: `bf39781:src/lib/baileys/handler.ts` líneas 57–65.
- Cálculo de horas por pares entrada/salida: `bf39781:src/lib/db.ts` línea
  ~954 (`calcularHorasTrabajadas`) y su uso en
  `bf39781:src/app/api/asistencia/horas/route.ts`.
- Semántica de `asistencia_rechazada` (motivos, aprobar/descartar):
  `bf39781:src/lib/db.ts` líneas ~810–900.
- Páginas de admin viejas como referencia visual: `bf39781:src/app/empleados/`,
  `src/app/sucursales/`, `src/app/asistencia/`, `src/app/horas/` (rehacer con
  Tailwind neutro, sin la paleta de San Cayetano — keep it simple).

**Desviaciones del spec (anotadas a propósito):**
- `otp_codes` guarda el código en una columna `code` en texto plano en vez de
  `code_hash`: el admin tiene que poder verlo para entregárselo al empleado.
  La tabla no tiene policies de lectura para clientes (solo service role), y
  los códigos son de 6 dígitos con expiración de 10 minutos. Cuando el envío
  sea por WhatsApp se puede volver a evaluar el hash.
- `empleados.device_token` es un token opaco random (32 bytes hex) guardado en
  la fila y en una cookie httpOnly — en vez de "cookie firmada". Equivalente
  en seguridad, más simple, y revocable con borrar el valor (botón
  "Desvincular").
- La vista "pendientes" del spec §6.8 (intentos que arrancaron y no
  completaron ubicación) se simplifica en v1 a "rechazadas sin resolver"
  (`asistencia_rechazada` con `resuelto = false`). Registrar intentos
  abandonados a mitad de camino queda como iteración posterior si hace falta.

---

## Task 1: Migración 0003 — sucursales, empleados, asistencia, asistencia_rechazada, otp_codes

**Files:**
- Create: `supabase/migrations/0003_asistencia.sql`
- Test: `src/lib/supabase/__tests__/asistencia-rls.test.ts`

```sql
create table sucursales (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  nombre text not null,
  lat double precision,
  lon double precision,
  radio_metros integer not null default 100,
  activa boolean not null default true,
  created_at timestamptz not null default now()
);

create table empleados (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  nombre text not null,
  celular text,
  device_token text unique,          -- vínculo dispositivo↔empleado (spec §6)
  activo boolean not null default true,
  created_at timestamptz not null default now()
);

create table asistencia (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  empleado_id uuid not null references empleados (id) on delete cascade,
  sucursal_id uuid not null references sucursales (id) on delete cascade,
  tipo text not null check (tipo in ('entrada', 'salida')),
  lat double precision not null,
  lon double precision not null,
  created_at timestamptz not null default now()
);

create table asistencia_rechazada (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references organizations (id) on delete cascade,
  empleado_id uuid references empleados (id) on delete set null,
  sucursal_id uuid references sucursales (id) on delete set null,
  tipo text check (tipo in ('entrada', 'salida')),
  lat double precision,
  lon double precision,
  distancia_metros integer,
  motivo text not null,   -- 'fuera_de_rango' | 'sucursal_sin_gps' | 'nombre_no_encontrado' | 'dispositivo_ya_vinculado'
  resuelto boolean not null default false,
  created_at timestamptz not null default now()
);

create table otp_codes (
  id uuid primary key default gen_random_uuid(),
  empleado_id uuid not null references empleados (id) on delete cascade,
  canal text not null default 'asistencia_web',
  code text not null,               -- ver "Desviaciones" arriba
  intentos integer not null default 0,
  expires_at timestamptz not null,
  used_at timestamptz,
  created_at timestamptz not null default now()
);

create index on asistencia (org_id, created_at);
create index on asistencia (empleado_id, created_at);
```

**RLS** (los grants ya los cubre el `alter default privileges` de 0001):
- `sucursales`, `empleados`, `asistencia`, `asistencia_rechazada`: policy
  `select` para miembros de la org (mismo patrón que 0001/0002). Sin policies
  de escritura: todo alta/edición pasa por rutas de servidor con service role
  + filtro `org_id` explícito (patrón del spec §4).
- `otp_codes`: sin policies para miembros — solo service role.

**Test:** mismo patrón que los tests RLS del Plan 1 — usuario de org A no ve
sucursales/empleados/asistencia de org B; sí ve los suyos.

**Verificación:** `npx supabase db reset` limpio + `npm test -- asistencia-rls`.

## Task 2: Libs puras portadas — matching de nombres y geocerca

**Files:**
- Create: `src/lib/nomina.ts`
- Create: `src/lib/geo.ts`
- Test: `src/lib/__tests__/nomina.test.ts`
- Test: `src/lib/__tests__/geo.test.ts`

Portar de `bf39781` adaptando a funciones puras que reciben la nómina como
parámetro (ya no leen SQLite):

- `normalizeNombre(s: string): string[]` (minúsculas, sin tildes, sin
  puntuación, palabras ordenadas).
- `validarEmpleado(nombres: string[], input: string): string | null` — exacto
  por palabras + subset (lógica de `validarEmpleadoDB`).
- `buscarEmpleadoParecido(nombres: string[], input: string): string | null` —
  Levenshtein por palabra con umbral según largo (`buscarEmpleadoParecido`).
- `haversineMetros(lat1, lon1, lat2, lon2): number` (tal cual del viejo
  handler).
- `dentroDeGeocerca(sucursal: {lat, lon, radio_metros}, lat, lon): { ok:
  boolean; distancia: number }`.

**Tests unitarios** (casos sacados de los comentarios del código viejo):
- Matching: exacto con palabras en otro orden; subset ("Sol Ruiz Díaz" vs
  "Ruiz Diaz Sol Evangelina"); ambiguo → null; tildes y mayúsculas.
- Aproximado: "Villaruel" sugiere "Villareal"; "Ana" no sugiere "Ale";
  ambiguo → null.
- Haversine: distancia conocida (~0m mismo punto; ~100m tolerado con radio
  100; fuera de rango).

## Task 3: Libs de datos — empleados, sucursales, OTP

**Files:**
- Create: `src/lib/empleados.ts`
- Create: `src/lib/sucursales.ts`
- Create: `src/lib/otp.ts`
- Tests: `src/lib/__tests__/empleados.test.ts`, `sucursales.test.ts`,
  `otp.test.ts`

Todas usan `createServiceClient()` con `org_id` explícito en cada query:

- `empleados.ts`: `listEmpleados(orgId)`, `createEmpleado(orgId, {nombre,
  celular?})`, `updateEmpleado(orgId, id, patch)`, `setEmpleadoActivo(orgId,
  id, activo)`, `getEmpleadoByDeviceToken(orgId, token)`,
  `vincularDispositivo(orgId, empleadoId, token)`,
  `desvincularDispositivo(orgId, empleadoId)`,
  `buscarEnNomina(orgId, input)` (usa libs de Task 2 sobre los activos).
- `sucursales.ts`: `listSucursales(orgId)`, `createSucursal(orgId, {nombre,
  lat?, lon?, radio_metros?})`, `updateSucursal(orgId, id, patch)`,
  `getSucursal(orgId, id)`.
- `otp.ts`:
  - `generarOtp(orgId, empleadoId): Promise<string>` — código de 6 dígitos,
    inserta en `otp_codes` con `expires_at = now() + 10 min`, invalida los
    anteriores no usados de ese empleado. Devuelve el código (lo ve el admin
    o la página de marcado como "pedile el código a tu encargado").
  - `verificarOtp(empleadoId, code): Promise<boolean>` — matchea código no
    usado y no expirado; suma `intentos` en cada intento fallido y bloquea al
    llegar a 5 (spec §12, límite de reintentos); al verificar OK marca
    `used_at`.

**Tests de integración** (contra Supabase local): CRUD con aislamiento por
org (crear en org A no aparece en org B), `buscarEnNomina` end-to-end con
nombres cargados, ciclo completo de OTP (generar → verificar OK; expirado →
false; 5 intentos mal → bloqueado; código ya usado → false).

## Task 4: Admin — páginas `/empleados` y `/sucursales` (+ QR)

**Files:**
- Create: `src/app/empleados/page.tsx` + `src/app/empleados/empleados-client.tsx`
- Create: `src/app/sucursales/page.tsx` + `src/app/sucursales/sucursales-client.tsx`
- Create: `src/app/api/empleados/route.ts` (GET/POST),
  `src/app/api/empleados/[id]/route.ts` (PATCH/DELETE),
  `src/app/api/empleados/[id]/desvincular/route.ts` (POST),
  `src/app/api/empleados/[id]/otp/route.ts` (POST — genera y devuelve código)
- Create: `src/app/api/sucursales/route.ts` (GET/POST),
  `src/app/api/sucursales/[id]/route.ts` (PATCH/DELETE),
  `src/app/api/sucursales/[id]/qr/route.ts` (GET → PNG)

**Autenticación:** mismo patrón que `/api/admin/organizations` (Plan 1):
`createServerClient` → `getUser` → `getCurrentOrg`; sin org → 403. Todas las
operaciones con service role + `org_id` de la sesión.

**`/empleados`** (keep it simple, una pantalla):
- Tabla: nombre, celular, estado del vínculo ("Vinculado" / "Sin vincular"),
  activo sí/no.
- Alta inline: nombre + celular (opcional).
- Acciones por fila: editar, activar/desactivar, **Desvincular** (borra
  `device_token` — spec §6.7), y **Generar código** (OTP): si el empleado no
  está vinculado y tiene un OTP vigente, se muestra el código grande y claro
  ("código de vinculación: 483 920 — vence en 8 min"); si no hay o venció, el
  botón genera uno nuevo. Esto es el canal de entrega provisional del OTP.

**`/sucursales`**:
- Tabla: nombre, lat/lon, radio, activa.
- Alta/edición: nombre + lat + lon + radio en metros (texto de ayuda: "sacá
  las coordenadas de Google Maps: click derecho → copiar").
- Botón **Ver QR** por sucursal: muestra el QR grande en pantalla con la URL
  debajo y botón de descarga (PNG). El QR apunta a
  `{NEXT_PUBLIC_BASE_URL}/marcar/{orgSlug}/{sucursalId}`.
- La ruta QR usa la librería `qrcode` (ya instalada) con `toBuffer` →
  respuesta `image/png`.

**Env nueva:** `NEXT_PUBLIC_BASE_URL` (default `http://localhost:3000`) —
va a `.env.example`, `.env.local`, `.env.test.local`.

**Verificación manual:** con `demo@test.local`, crear sucursal y empleado,
ver el QR, generar un código y verlo en pantalla.

## Task 5: Página pública de marcado `/marcar/[org]/[sucursal]`

**Files:**
- Create: `src/app/marcar/[org]/[sucursal]/page.tsx` (server component)
- Create: `src/app/marcar/[org]/[sucursal]/marcar-client.tsx` (client)
- Create: `src/app/api/marcar/identificar/route.ts` (POST, pública)
- Create: `src/app/api/marcar/verificar/route.ts` (POST, pública)
- Create: `src/app/api/marcar/registrar/route.ts` (POST, pública)
- Modify: `src/lib/auth/public-paths.ts` (+ test) — agregar `/marcar` y
  `/api/marcar` como públicos.
- Create: `src/lib/device-token.ts` — leer/emitir la cookie httpOnly
  `oliver_device` (maxAge 1 año, sameSite=lax; secure solo en producción).

**Flujo (spec §6):**

1. El server component resuelve org por slug y sucursal por id (ambas activas,
   la sucursal pertenece a la org — si no, 404 amigable) y lee la cookie
   `oliver_device`. Le pasa al client component un estado inicial:
   - **Con token válido** (`getEmpleadoByDeviceToken` encuentra empleado
     activo de esa org) → pantalla "Hola, {nombre}" + botones grandes
     **"Marcar entrada"** y **"Marcar salida"**.
   - **Sin token** → pantalla de identificación: campo "Tu nombre y apellido".
2. **Identificación** (`POST /api/marcar/identificar` `{orgSlug, sucursalId,
   nombre}`):
   - `buscarEnNomina` exacto/subset; si no matchea, `buscarEmpleadoParecido`
     → respuesta "¿Sos {nombre}?" (confirmar en la UI, misma idea del bot
     viejo); si tampoco → mensaje claro + registro en `asistencia_rechazada`
     con motivo `nombre_no_encontrado`.
   - Si el empleado ya tiene `device_token` → rechazo "este nombre ya está
     vinculado a otro dispositivo" (misma regla de siempre, spec §6) +
     registro con motivo `dispositivo_ya_vinculado`. El admin resuelve con
     "Desvincular".
   - Si no tiene → `generarOtp` y la UI dice: "Pedile el código de
     vinculación a tu encargado" + campo para el código.
3. **Verificación** (`POST /api/marcar/verificar` `{empleadoId, code}`):
   `verificarOtp` → si OK, `vincularDispositivo` con token nuevo y se setea la
   cookie. Errores claros: código incorrecto (con intentos restantes),
   vencido o bloqueado → "pedile uno nuevo a tu encargado".
4. **Marcado** (client): al tocar Entrada/Salida pide geolocalización del
   navegador y manda `POST /api/marcar/registrar` `{sucursalId, tipo, lat,
   lon}` (con la cookie):
   - Sucursal sin GPS configurado → `asistencia_rechazada` motivo
     `sucursal_sin_gps` + mensaje (spec §12).
   - `dentroDeGeocerca` OK → insert en `asistencia` → pantalla de éxito
     ("Entrada registrada a las 08:03 ✔"). Nada más — simple.
   - Fuera de rango → `asistencia_rechazada` motivo `fuera_de_rango` con
     distancia → mensaje "Estás a X m de la sucursal (máximo Y m)".
   - Geolocalización denegada en el navegador → mensaje explicando que es
     obligatoria y cómo habilitarla (spec §12) — manejo client-side, no llega
     al server.

**Tests:**
- `public-paths`: `/marcar` y `/api/marcar/*` públicos, `/empleados` sigue
  protegido.
- Integración de los 3 handlers contra Supabase local: identificar con nombre
  exacto / parecido / inexistente / ya vinculado; verificar con código bueno,
  malo (intentos), vencido; registrar dentro/fuera de geocerca y sucursal sin
  GPS (asserts sobre `asistencia` y `asistencia_rechazada`).

## Task 6: Admin — `/asistencia` (registros + rechazadas) y `/horas`

**Files:**
- Create: `src/app/asistencia/page.tsx` (+ client) — registros del rango +
  sección "Intentos rechazados" con Aprobar/Descartar.
- Create: `src/app/horas/page.tsx` (+ client) — turnos y resumen por empleado.
- Create: `src/app/api/asistencia/route.ts` (GET lista con filtros, DELETE),
  `src/app/api/asistencia/rechazadas/route.ts` (GET),
  `src/app/api/asistencia/rechazadas/[id]/route.ts` (POST
  `?accion=aprobar|descartar`)
- Create: `src/app/api/horas/route.ts` (GET)
- Create: `src/lib/asistencia.ts` — `listAsistencia(orgId, {desde, hasta,
  sucursalId?, empleadoId?})`, `deleteAsistencia(orgId, id)`,
  `listRechazadas(orgId)`, `aprobarRechazada(orgId, id)` (inserta en
  `asistencia` con la fecha/hora original del intento y marca `resuelto`,
  misma semántica del viejo `aprobarAsistenciaRechazada`),
  `descartarRechazada(orgId, id)`, `calcularHoras(orgId, {desde, hasta,
  sucursalId?})`.

**`calcularHoras`:** port de `calcularHorasTrabajadas` a Postgres — pares
entrada→salida por empleado+sucursal ordenados por `created_at`; salida sin
entrada o entrada sin salida queda "en curso" (`horas: null`). Fechas en zona
`America/Argentina/Buenos_Aires` (como el viejo: default desde el 1° del mes
a hoy). Devuelve `turnos` + `resumen` por empleado (total horas, en curso)
como la API vieja.

**UI:** `/asistencia` = tabla de registros (empleado, sucursal, tipo, hora)
con filtro de fechas y borrado individual; arriba la sección de rechazadas
pendientes (motivo legible, distancia, botones Aprobar/Descartar).
`/horas` = rango de fechas + tabla de turnos + resumen por empleado. Sin
export a Excel en este plan (exceljs queda instalado; se suma si hace falta).

**Tests de integración:** `calcularHoras` con datos sembrados (2 pares +
1 entrada sin salida), `aprobarRechazada` respeta la hora original y exige
sucursal/tipo, aislamiento por org en `listAsistencia`.

## Task 7: Navegación, home, datos demo y cierre

**Files:**
- Create: `src/app/(panel)/layout.tsx`… **no** — keep it simple: un solo
  `src/components/org-nav.tsx` (nav con links: Inicio, Asistencia, Horas,
  Empleados, Sucursales) incluido desde `src/app/page.tsx` y las páginas de
  admin vía un layout liviano `src/app/(panel)/layout.tsx` solo si no ensucia
  las rutas públicas; decidir en implementación lo más simple que compile.
- Modify: `src/app/page.tsx` — home de la org: nombre + accesos directos
  grandes a Asistencia / Empleados / Sucursales (reemplaza "en construcción").
- Modify: `README.md` — estado del refactor (Plan 2 = Asistencia hecho,
  WhatsApp pasa a ser el siguiente), cómo probar el marcado localmente.
- Modify: `docs/superpowers/plans/` — este plan se guarda primero como
  `2026-08-13-asistencia-multi-sucursal.md` y se van marcando los checkboxes.

**Datos demo** (para que el usuario pruebe de inmediato, con la org "Cliente
de prueba" y `demo@test.local` ya existentes): sucursal "Casa Central"
(coordenadas placeholder para editar) + empleado "Empleado Demo".

**E2E manual (spec §13 adaptado, todo local):**
1. Admin crea sucursal (con sus coordenadas reales) y empleado.
2. Abre el QR / la URL `/marcar/...` en el teléfono o el navegador.
3. Escribe el nombre → la UI pide el código → el admin lo ve en `/empleados`.
4. Ingresa el código → dispositivo vinculado → botones de marcado.
5. Marca entrada (con GPS real o ubicación simulada del navegador) → aparece
   en `/asistencia`. Marca salida → el turno cierra en `/horas`.
6. Desde otra ventana de incógnito con el mismo nombre → rechazo
   "ya vinculado". Admin desvincula → se puede revincular con código nuevo.
7. Marcar lejos de la sucursal → rechazado con distancia, aparece en
   rechazadas; Aprobar lo mueve a `asistencia` con la hora original.

**Cierre:** `npm test` en verde, `npm run build` limpio, **un solo commit al
final** (`feat: módulo de asistencia multi-sucursal — Plan 2`), dejar
`npm run dev` + Supabase corriendo.

## Explícitamente fuera de alcance

- Envío del OTP por WhatsApp (llega con el plan del canal; solo cambia el
  medio de entrega — `generarOtp`/`verificarOtp` no se tocan).
- Canal WhatsApp Cloud API completo (Embedded Signup, webhook,
  conversaciones) y cualquier respuesta con IA.
- Registro de intentos abandonados a mitad de flujo (ver "Desviaciones").
- Export a Excel de asistencia/horas (exceljs ya está instalado).
- RRHH (Plan 4 del spec — reutiliza `empleados`, `sucursales` y el vínculo
  de identidad de este plan).
