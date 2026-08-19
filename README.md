# Oliver

Plataforma multi-tenant (SaaS) para control de asistencia. **Vite + React**
(frontend, `web/`) y **Fastify** (backend, `server/`), con persistencia y
autenticación en Supabase (Postgres con Row Level Security + Supabase
Auth). Cada cliente tiene su propia organización con datos completamente
aislados.

El diseño completo está en
`docs/superpowers/specs/2026-08-12-whatsapp-saas-platform-design.md` y los
planes de implementación en `docs/superpowers/plans/`.

## Requisitos

- Node.js >= 22.5.0
- Docker corriendo (para el stack local de Supabase)

## Setup rápido

```bash
# 1. Instalar dependencias (raíz, server/ y web/)
npm install
npm install --prefix server
npm install --prefix web

# 2. Levantar el stack local de Supabase (Postgres + Auth + API + Studio)
npx supabase start

# 3. Crear los archivos de variables de entorno con las keys locales
#    (las imprime `npx supabase status` -o env)
cp .env.example .env.local
cp server/.env.example server/.env.local
cp web/.env.example web/.env.local
# Editá los tres .env.local con los valores del paso anterior

# 4. Aplicar las migraciones (esto también borra todo dato existente)
npx supabase db reset

# 5. Crear el usuario/org/sucursal/empleado de prueba (idempotente)
node scripts/seed-demo.js

# 6. Levantar todo
npm run dev:all
```

Después entrá a `http://localhost:5173`. Si tu usuario tiene rol de
platform admin (ver "Probar el panel de superadmin" más abajo), el panel
de superadmin está en `http://localhost:5173/admin` — sin link en el nav,
acceso directo por URL.

Studio de Supabase (UI de la base local): http://127.0.0.1:54323

## Variables de entorno

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de la API de Supabase (`http://127.0.0.1:54321` en local) — nombre heredado de cuando el proyecto era Next.js; hoy la lee `scripts/seed-demo.js` desde `.env.local` |
| `SUPABASE_SERVICE_ROLE_KEY` | Key de service role (solo servidor, salta RLS) — la lee `scripts/seed-demo.js` |

`server/.env.local` y `web/.env.local` tienen sus propias variables — ver
`server/.env.example` y `web/.env.example`. `web/.env.local` es
**requerido** (no opcional): `web/src/lib/supabase.ts` tira una excepción
al cargar el módulo si faltan `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`,
lo que rompe toda la SPA.

## Correr todo en dev

```bash
# Con Supabase local corriendo (npx supabase start):
npm run dev:all
```

Levanta Fastify (`:3001`, la API) y Vite (`:5173`, el panel de
organización completo, el panel de superadmin y el flujo público
`/marcar`). También se pueden levantar por separado con `npm run dev
--prefix server` y `npm run dev --prefix web`.

## Probar el marcado de asistencia localmente

1. Entrá con un usuario que tenga una organización (`demo@test.local` en el
   seed de pruebas, o creá la tuya).
2. En `/sucursales`, dale **Ver QR** a una sucursal con lat/lon cargados —
   la URL que apunta el QR es `/marcar/{orgSlug}/{sucursalId}`.
3. Abrí esa URL (podés escanear el QR o pegarla en otra pestaña/incógnito).
4. Escribí tu nombre y apellido tal como está cargado en `/empleados`. Si no
   matchea exacto te va a sugerir el más parecido.
5. Pedí el código de vinculación en `/empleados` (botón **Generar código**
   en la fila del empleado) y cargalo en la página de marcado.
6. Con el dispositivo ya vinculado, tocá **Marcar entrada** — el navegador
   va a pedir geolocalización (obligatoria: sin ubicación no se puede
   marcar). Si estás fuera del radio de la sucursal, el intento queda en
   "Intentos rechazados" en `/asistencia` para aprobar o descartar a mano.
7. Los turnos completos (entrada + salida) se ven en `/horas` con el total
   de horas por empleado.

## Probar el panel de superadmin localmente

`/admin` requiere que tu usuario esté en la tabla `platform_admins`. Para
dártelo de alta en local, abrí el Studio de Supabase
(http://127.0.0.1:54323) → SQL Editor, y corré:

```sql
insert into platform_admins (user_id)
select id from auth.users where email = 'demo@test.local';
```

Entrá a `http://localhost:5173/admin` — vas a ver el listado de
organizaciones y un form para dar de alta una nueva.

## Estado del refactor

- **Plan 1 — Foundation (hecho)**: multi-tenancy real (`organizations`,
  `org_members`, `org_settings`, `platform_admins`) con RLS probado, login
  con Supabase Auth, panel de superadmin, y repositorio limpio del stack
  anterior (Baileys, SQLite, PM2, código específico de un cliente).
- **Plan 2 — Módulo de Asistencia multi-sucursal (hecho)**: alta de
  sucursales y empleados con QR, vínculo dispositivo↔empleado por OTP,
  marcado público de entrada/salida con geocerca, revisión de intentos
  rechazados y cálculo de horas trabajadas. Detalle completo en
  `docs/superpowers/plans/2026-08-13-asistencia-multi-sucursal.md`.
- **Plan 3 — Canal de WhatsApp Cloud API + agente IA**: pendiente (Embedded
  Signup + webhook + dashboard de conversaciones, sin IA al principio).
- **Plan 4 — Módulo de RRHH**: pendiente (reutiliza `empleados`,
  `sucursales` y el vínculo de identidad de Asistencia).
- **Migración de Next.js a Vite + Fastify (hecho)**: el panel completo
  (organización + superadmin) y el flujo público `/marcar` viven en `web/`
  (Vite + React) + `server/` (Fastify), con el sistema de diseño
  "Modernist" aplicado. Detalle de las 5 etapas en
  `docs/superpowers/plans/` y `docs/superpowers/specs/` (archivos
  `vite-migra*`).

## Estructura

- `web/` — frontend (Vite + React + TypeScript + Tailwind v4)
- `server/` — backend (Fastify + TypeScript)
- `supabase/migrations` — migraciones de la base (se aplican con
  `npx supabase db reset`)
- `scripts/seed-demo.js` — datos de prueba idempotentes
