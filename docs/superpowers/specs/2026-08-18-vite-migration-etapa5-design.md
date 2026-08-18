# Migración a Vite — Etapa 5: Admin + baja completa de Next.js

Fecha: 2026-08-18
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

Continuación de `docs/superpowers/specs/2026-08-18-vite-migration-etapa4-design.md`.
Tras la Etapa 4, todo el panel de organización (Login, Home, Sucursales,
Empleados, Asistencia, Horas) y el flujo público `/marcar` viven en `web/`
(Vite+React) + `server/` (Fastify). En Next.js solo queda el panel de
superadmin (`/admin`, alta y listado de organizaciones) y su propio
`/login`, necesario únicamente para acceder a `/admin` — un total de 186
líneas entre `src/app/admin/page.tsx`, `src/app/login/page.tsx`,
`src/middleware.ts` y `src/lib/admin.ts`, más una API route
(`src/app/api/admin/organizations/route.ts`) y los libs de soporte
`src/lib/organizations.ts`/`org.ts`.

A diferencia de las etapas anteriores, esta es la última: no queda nada
del panel viejo después. Motivación explícita del usuario: simplificar el
deploy (dejar de mantener dos apps corriendo) y consistencia de stack (todo
el proyecto en Vite+Fastify, sin una isla de Next.js que nadie más toca).
No hay una urgencia funcional — es una decisión de arquitectura, no un
bug o una necesidad de producto.

## 2. Decisiones tomadas con el usuario

- **Alcance = migrar `/admin` Y dar de baja Next.js por completo en la
  misma etapa** — no queda ningún archivo del stack viejo al cerrar, a
  diferencia de las etapas 1-4 donde siempre sobrevivía algo.
- **Acceso a `/admin` en `web/`: por URL directa, sin auto-redirect.** Hoy
  Next.js detecta con `isPlatformAdmin` en `src/app/page.tsx` y redirige
  automáticamente tras el login (agregado en la Etapa 4). Se decidió NO
  portar ese auto-redirect — un platform admin escribe `/admin` a mano,
  igual que en la práctica ya hace. Evita construir lógica de detección de
  rol en el flujo de login de `web/` que hoy no existe en ningún lado.
  Un platform admin sin organización que caiga en Home de `web/` sigue
  viendo el mensaje "Tu cuenta todavía no está asociada a ninguna
  organización" (comportamiento sin cambios, ya es el caso hoy para
  cualquier usuario sin org).
- **Sin link a `/admin` en `PanelNav`** — sigue siendo una pantalla de
  acceso directo, no parte de la navegación del panel de organización
  (mismo comportamiento que tiene hoy en Next.js).

## 3. Arquitectura

### 3.1 Backend (`server/`)

- **`server/src/plugins/require-platform-admin.ts`** (nuevo): preHandler
  que corre después de `requireAuth` (NO después de `requireOrg` — un
  platform admin puede no tener organización). Llama a `isPlatformAdmin`,
  devuelve 403 si no lo es.
- **`server/src/lib/admin.ts`** (nuevo, portado 1:1 de `src/lib/admin.ts`):
  `isPlatformAdmin(userId)`.
- **`server/src/lib/organizations.ts`** (nuevo, portado 1:1 de
  `src/lib/organizations.ts`): `createOrganization({name, slug})` — inserta
  en `organizations` y `org_settings`.
- **`server/src/routes/admin.ts`** (nuevo), todas con
  `{ preHandler: [requireAuth, requirePlatformAdmin] }`:
  - `GET /api/admin/organizations` — lista completa (`id, name, slug,
    plan, created_at`), sin filtro por org (a diferencia de todo lo demás
    en `server/`, esta ruta ve todas las organizaciones a propósito).
  - `POST /api/admin/organizations` — alta (`name`+`slug` requeridos),
    devuelve la organización creada o 400 con el mensaje de error.

### 3.2 Frontend (`web/`)

- **`web/src/lib/api.ts`**: `listOrganizationsAdmin()`,
  `createOrganizationAdmin(input)` — mismo patrón `request<T>()` que el
  resto del archivo.
- **`web/src/pages/admin/hooks.ts`**: `useOrganizacionesAdmin` (`useQuery`),
  `useCrearOrganizacionAdmin` (`useMutation`, invalida la lista).
- **`web/src/pages/admin/AdminPage.tsx`**: form de alta (nombre + slug) +
  tabla de organizaciones (nombre, slug, plan, fecha de alta). Si el
  server devuelve 403, se muestra el mismo patrón de error que ya usa
  `HomePage` (mensaje + sin acceso).
- **`web/src/App.tsx`**: ruta `/admin`, mismo `ProtectedRoute` que las
  demás (verifica sesión; el rol de platform admin lo verifica el server,
  no el cliente) — **sin** `PanelLayout` (no lleva el nav del panel de
  organización, es una pantalla aparte).

### 3.3 Baja de Next.js

Una vez migrado y verificado `/admin`:
- Borrar `src/` completo, `next.config.ts`, `next-env.d.ts`,
  `middleware.ts`.
- `package.json` (raíz): sacar `next`, `@supabase/ssr` (si no lo usa nada
  más), los scripts `dev`/`build`/`start`, y el proceso `next` de
  `dev:all` (`concurrently` queda con `server`+`web` nada más).
- `docs/`: no se tocan los specs/plans viejos (son historial), pero
  `README.md` se actualiza para reflejar que ya no hay Next.js en el
  proyecto (setup, estructura, variables de entorno).
- Revisar `vitest.config.ts`/`vitest.setup.ts` (raíz) y `.env.test.local`:
  si nada más los usa una vez borrado `src/`, se borran también.

## 4. Alcance de la Etapa 5

### Dentro de alcance

- `requirePlatformAdmin` + las 2 rutas nuevas en `server/`.
- `/admin` completa en `web/` (listado + alta de organizaciones).
- Borrado completo de Next.js: `src/`, config, dependencias, scripts.
- Actualización de `README.md`.

### Fuera de alcance

- Cualquier feature nueva sobre el panel de superadmin (edición/borrado de
  organizaciones, gestión de `platform_admins`, etc.) — se porta tal cual
  existe hoy.
- Deploy/infra real (esto es sobre el código del repo, no sobre dónde se
  hostea cada proceso en producción).

### QA

Sin tests automatizados nuevos — verificación manual del usuario al
final, mismo patrón que las etapas anteriores.

### Criterio de "listo"

- Un platform admin puede entrar a `http://localhost:5173/admin`, ver el
  listado de organizaciones y crear una nueva.
- Un usuario logueado que NO es platform admin, al visitar `/admin`, ve un
  error de acceso (no la lista).
- El repo ya no tiene ningún archivo de Next.js — `npm run dev:all` (o
  como se llame tras el cambio) levanta solo `server/`+`web/`.
- `README.md` no menciona Next.js como parte del stack actual.

## 5. Explícitamente fuera de alcance de este documento

- Cualquier cambio al modelo de datos de `platform_admins` u
  `organizations`.
- Cobertura de tests automatizados (fuera de alcance de todo el proyecto
  por ahora, decisión explícita del usuario).
