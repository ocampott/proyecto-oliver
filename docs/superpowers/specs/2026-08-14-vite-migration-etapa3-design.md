# Migración a Vite — Etapa 3: Sucursales + Empleados

Fecha: 2026-08-14
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

Continuación de `docs/superpowers/specs/2026-08-13-vite-migration-design.md`
(roadmap §5). Las Etapas 1 y 2 dejaron `/marcar`, `/login` y el Home
funcionando de punta a punta en `web/` (Vite+React+Tailwind) + `server/`
(Fastify). Esta etapa migra las primeras dos pantallas CRUD reales del
panel: **Sucursales** (altas, geocerca, QR) y **Empleados** (altas,
vínculo de dispositivo por OTP).

A diferencia de la Etapa 2 (donde Login no se pudo borrar de Next.js
porque otras pantallas todavía lo necesitaban), acá **sí aplica el
reemplazo directo** de la Etapa 1: se confirmó que Asistencia y Horas
(que siguen en Next.js hasta la Etapa 4) no dependen en nada de las
páginas ni de las rutas `/api/sucursales` / `/api/empleados` de Next.js.

## 2. Decisiones tomadas con el usuario

- **TanStack Query** se suma en esta etapa (pedido explícito del usuario
  en la Etapa 2, diferido a acá a propósito: recién ahora hay pantallas
  con el patrón listar/crear/editar que lo justifican).
- **QR de sucursal:** el endpoint que genera el PNG sigue protegido con
  Bearer token igual que todo lo demás (no se hace público). El frontend
  lo pide con `fetch()` mandando el token, arma un blob URL, y se lo pasa
  al `<img>` — en vez de un `<img src="...">` directo, que no puede mandar
  headers custom.
- **Borrado de código viejo:** al final de la etapa, una vez verificado en
  el navegador, se borran `src/app/(panel)/sucursales/`,
  `src/app/(panel)/empleados/`, `src/app/api/sucursales/` y
  `src/app/api/empleados/` de Next.js.

## 3. Arquitectura

### 3.1 Backend (`server/`)

- **`requireOrg`** (`server/src/plugins/require-org.ts`, nuevo): preHandler
  que corre después de `requireAuth`, llama a `getCurrentOrg(request.user.id)`
  y decora `request.org`; devuelve 403 si el usuario no tiene organización.
  Reemplaza el patrón `requireOrg()` de Next.js como un preHandler
  reusable en vez de código repetido por ruta — lo van a volver a usar las
  rutas de Asistencia/Horas en la Etapa 4.
- **`server/src/routes/sucursales.ts`** (nuevo), todas con `requireOrg`:
  - `GET /api/sucursales` — lista.
  - `POST /api/sucursales` — alta (`nombre` requerido; `lat`/`lon`/`radio_metros` opcionales).
  - `PATCH /api/sucursales/:id` — edición parcial (nombre, lat, lon, radio_metros, activa).
  - `DELETE /api/sucursales/:id` — borrado lógico (`activa: false`, conserva el historial de asistencia).
  - `GET /api/sucursales/:id/qr` — PNG (librería `qrcode`, nueva dependencia de `server/`) con la URL de `/marcar/{orgSlug}/{sucursalId}` apuntando a `web/` (mismo `NEXT_PUBLIC_BASE_URL`/equivalente ya usado en la Etapa 1).
- **`server/src/routes/empleados.ts`** (nuevo), todas con `requireOrg`:
  - `GET /api/empleados` — lista, incluye el OTP vigente de cada empleado sin vincular (mismo enriquecido que hace hoy `EmpleadosPage` de Next.js).
  - `POST /api/empleados` — alta (`nombre` requerido, `celular` opcional).
  - `PATCH /api/empleados/:id` — edición (nombre, celular, activo).
  - `DELETE /api/empleados/:id` — borrado lógico.
  - `POST /api/empleados/:id/desvincular` — borra el `device_token`.
  - `POST /api/empleados/:id/otp` — genera un código nuevo, lo devuelve para mostrárselo al admin.

### 3.2 Frontend (`web/`)

- **TanStack Query**: `QueryClientProvider` montado en `App.tsx`, fuera de
  `AuthProvider` (no depende de la sesión).
- **`web/src/lib/api.ts`**: se agregan las funciones de sucursales y
  empleados, mismo patrón que `getOrgActual` (pasan por `request()`, que
  ya manda el Bearer token).
- **Hooks por pantalla** (`web/src/pages/sucursales/hooks.ts`,
  `web/src/pages/empleados/hooks.ts`): `useQuery` para las listas,
  `useMutation` para alta/edición/baja — cada mutación invalida la query
  de la lista correspondiente al completarse, reemplazando el
  `router.refresh()` de Next.js.
- **`useQrBlob(sucursalId)`** (`web/src/pages/sucursales/`): pide el PNG
  con `fetch()` + Bearer token, arma un blob URL con
  `URL.createObjectURL`, lo libera con `revokeObjectURL` al desmontar o
  cambiar de sucursal.
- **`/sucursales`** y **`/empleados`**: reconstruidas con `Button`,
  `Input`, `Card`, `Table` del sistema de diseño — mismo comportamiento
  que las páginas actuales de Next.js (alta inline, edición en línea,
  activar/desactivar, visor de QR con descarga en Sucursales, generación
  de código OTP y desvincular en Empleados).
- **Rutas**: `/sucursales` y `/empleados` se agregan a `App.tsx` dentro
  del mismo `ProtectedRoute` + `PanelLayout` que ya envuelve `/`.
- **Nav y Home**: los links/tarjetas de "Sucursales" y "Empleados" pasan
  de deshabilitados a activos en `PanelNav` y `HomePage`. Asistencia y
  Horas quedan como los únicos deshabilitados hasta la Etapa 4.

## 4. Alcance de la Etapa 3

### Dentro de alcance

- `requireOrg` + las 9 rutas nuevas en `server/`.
- TanStack Query montado + hooks de sucursales y empleados.
- `/sucursales` y `/empleados` completas en `web/`, con QR vía blob.
- Activar los links correspondientes en `PanelNav`/`HomePage`.
- Borrar `src/app/(panel)/sucursales/`, `src/app/(panel)/empleados/`,
  `src/app/api/sucursales/`, `src/app/api/empleados/` de Next.js, una vez
  verificado.

### Fuera de alcance (sigue en Next.js hasta su etapa)

Asistencia, Horas, y el panel de superadmin (`/admin`).

### QA

Sin tests automatizados nuevos — verificación manual del usuario al
final, mismo patrón que las etapas anteriores.

### Criterio de "listo"

- Se puede dar de alta, editar y desactivar una sucursal y un empleado
  desde `web/`.
- El QR de una sucursal se ve y se puede descargar.
- Se puede generar un código OTP para un empleado y desvincular su
  dispositivo.
- Los datos persisten (recargar la página no los pierde) y las listas se
  actualizan solas después de cada alta/edición/baja, sin recargar la
  página entera.
- `src/app/(panel)/sucursales/`, `src/app/(panel)/empleados/`,
  `src/app/api/sucursales/`, `src/app/api/empleados/` quedan borrados de
  Next.js, y el resto del panel (Asistencia, Horas, `/admin`) sigue
  funcionando sin cambios.

## 5. Explícitamente fuera de alcance de este documento

- Etapa 4 (Asistencia + Horas) en detalle.
- Export a Excel de sucursales/empleados (no estaba en el alcance
  original tampoco).
