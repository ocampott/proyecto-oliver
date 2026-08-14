# Oliver

Plataforma multi-tenant (SaaS) en construcción. Una sola app Next.js con
persistencia y autenticación en Supabase (Postgres con Row Level Security +
Supabase Auth). Cada cliente tiene su propia organización con datos
completamente aislados.

El diseño completo está en
`docs/superpowers/specs/2026-08-12-whatsapp-saas-platform-design.md` y los
planes de implementación en `docs/superpowers/plans/`.

## Requisitos

- Node.js >= 22.5.0
- Docker corriendo (para el stack local de Supabase)

## Setup rápido

```bash
# 1. Instalar dependencias
npm install

# 2. Levantar el stack local de Supabase (Postgres + Auth + API + Studio)
npx supabase start

# 3. Crear el archivo de variables de entorno con las keys locales
#    (las imprime `npx supabase status` -o env)
cp .env.example .env.local
# Editá .env.local con los valores del paso anterior

# 4. Aplicar las migraciones (esto también borra todo dato existente)
npx supabase db reset

# 5. Crear el usuario/org/sucursal/empleado de prueba (idempotente)
node scripts/seed-demo.js

# 6. Levantar el frontend
npm run dev
```

Después abrí http://localhost:3000 — te redirige a `/login`.

Studio de Supabase (UI de la base local): http://127.0.0.1:54323

## Tests

```bash
npm test
```

Corren contra el stack local de Supabase (lee `.env.test.local`), así que
necesitan `npx supabase start` activo. Incluyen tests de integración que
verifican el aislamiento por organización vía RLS.

## Variables de entorno

| Variable | Descripción |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | URL de la API de Supabase (`http://127.0.0.1:54321` en local) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Key pública (anon) |
| `SUPABASE_SERVICE_ROLE_KEY` | Key de service role (solo servidor, salta RLS) |
| `NEXT_PUBLIC_BASE_URL` | Base pública de la app (default `http://localhost:3000`) — se usa para armar la URL de cada QR de sucursal |
| `OPENROUTER_API_KEY` | API key de OpenRouter (la usa el futuro módulo del canal de WhatsApp) |
| `OPENROUTER_MODEL` | Modelo a usar (default `openai/gpt-4o-mini`) |

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

## Estado del refactor

- **Plan 1 — Foundation (hecho)**: multi-tenancy real (`organizations`,
  `org_members`, `org_settings`, `platform_admins`) con RLS probado, login
  con Supabase Auth, panel de superadmin en `/admin`, y repositorio limpio
  del stack anterior (Baileys, SQLite, PM2, código específico de un cliente).
- **Plan 2 — Módulo de Asistencia multi-sucursal (hecho)**: alta de
  sucursales y empleados con QR (`/sucursales`, `/empleados`), vínculo
  dispositivo↔empleado por OTP, marcado público de entrada/salida con
  geocerca (`/marcar/[org]/[sucursal]`), revisión de intentos rechazados y
  cálculo de horas trabajadas (`/asistencia`, `/horas`). Detalle completo en
  `docs/superpowers/plans/2026-08-13-asistencia-multi-sucursal.md`.
- **Plan 3 — Canal de WhatsApp Cloud API + agente IA**: pendiente (Embedded
  Signup + webhook + dashboard de conversaciones, sin IA al principio).
- **Plan 4 — Módulo de RRHH**: pendiente (reutiliza `empleados`,
  `sucursales` y el vínculo de identidad de Asistencia).

## Migración a Vite (en curso)

El panel se está migrando de Next.js a **Vite + React** (frontend, carpeta
`web/`) y **Fastify** (backend, carpeta `server/`), con el sistema de
diseño de `docs/superpowers/specs/2026-08-13-vite-migration-design.md`
aplicado. La migración es **por etapas** y **por reemplazo directo**: cada
pantalla se borra de Next.js en el momento en que su versión nueva queda
lista, así que durante la migración el panel vive parcialmente en cada
stack.

**Estado actual:** el flujo público `/marcar` ya vive en `web/` + `server/`
y fue borrado de Next.js. El resto del panel (login, home, sucursales,
empleados, asistencia, horas) sigue en Next.js.

### Correr todo en dev

```bash
# Con Supabase local corriendo (npx supabase start):
npm run dev:all
```

Esto levanta los tres procesos a la vez: Next.js (`:3000`, el resto del
panel), Fastify (`:3001`, la API de `web/`) y Vite (`:5173`, el flujo de
`/marcar`). También se pueden levantar por separado con `npm run dev`,
`npm run dev --prefix server` y `npm run dev --prefix web`.

Cada proyecto tiene su propio `.env.local`:
- Raíz (`​.env.local`): igual que antes, lo usa Next.js.
- `server/.env.local`: mismas credenciales de Supabase, nombres de
  variable sin el prefijo `NEXT_PUBLIC_` (ver `server/.env.example`).
- `web/.env.local`: opcional, solo si `server/` no corre en el puerto
  default (ver `web/.env.example`).

## Estructura

- `src/app` — páginas y route handlers (App Router)
- `src/lib` — lógica de servidor (helpers de organización, clientes de
  Supabase, OpenRouter)
- `supabase/migrations` — migraciones de la base (se aplican con
  `npx supabase db reset`)
- `src/middleware.ts` — verificación de sesión en cada request
