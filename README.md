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
- **No hace falta Docker ni Supabase local.** El proyecto corre contra un
  proyecto Supabase remoto compartido (no hay stack local ni `supabase
  start`/`db reset`) — pedile a quien te invitó las variables de entorno
  reales (`SUPABASE_URL`, `SUPABASE_ANON_KEY`, `SUPABASE_SERVICE_ROLE_KEY`,
  `GOOGLE_MAPS_API_KEY`).

## Setup rápido

```bash
# 1. Instalar dependencias (raíz, server/ y web/)
npm install
npm install --prefix server
npm install --prefix web

# 2. Crear los archivos de variables de entorno
cp server/.env.example server/.env.local
cp web/.env.example web/.env.local
# Completar los dos .env.local con los valores reales del proyecto
# (te los pasa quien te invitó) — apuntan al mismo Supabase remoto
# compartido, no hay que crear ni migrar ninguna base propia.

# 3. Levantar todo (server + web juntos)
npm start
```

Después entrá a `http://localhost:5173` y logueate con una de las
**cuentas de prueba** de la sección de abajo. Si tu usuario tiene rol de
platform admin (la cuenta `qa-superadmin`, ver más abajo), el panel de
superadmin está en `http://localhost:5173/admin` — sin link en el nav,
acceso directo por URL.

## Cuentas de prueba

La base remota compartida tiene 4 cuentas listas para probar cada nivel
de plan, contraseña `qa123456` para todas:

| Email | Plan | Qué podés probar |
|---|---|---|
| `qa-gratis@test.local` | Gratis | Solo el módulo de Asistencia — el resto (Horas, RRHH, Turnos) debería estar bloqueado |
| `qa-basico@test.local` | Básico | Asistencia + Horas + Turnos + RRHH + Reportes |
| `qa-pro@test.local` | Pro | Todo lo del plan Básico + límites ilimitados de sucursales/empleados |
| `qa-superadmin@test.local` | — (superadmin) | Acceso total sin límites de ningún plan, más el panel `/admin` para gestionar organizaciones y suscripciones |

Cada una es dueña de su propia organización (un usuario pertenece a una
sola org), así que no hace falta invitar ni cambiar de cuenta para probar
el resto del panel — usá la que corresponda a lo que estés probando.

## Variables de entorno

`server/.env.local` y `web/.env.local` tienen sus propias variables — ver
`server/.env.example` y `web/.env.example`. `web/.env.local` es
**requerido** (no opcional): `web/src/lib/supabase.ts` tira una excepción
al cargar el módulo si faltan `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`,
lo que rompe toda la SPA.

## Correr todo en dev

```bash
npm start
```

Levanta Fastify (la API, puerto de `server/.env.local`) y Vite (el panel
de organización completo, el panel de superadmin y el flujo público
`/marcar`, puerto de `web/.env.local`) juntos, con logs de ambos
intercalados. También se pueden levantar por separado con `npm run dev
--prefix server` y `npm run dev --prefix web`, o correr solo el script sin
el alias con `npm run dev:all`.

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

`/admin` requiere que tu usuario esté en la tabla `platform_admins`. La
cuenta `qa-superadmin@test.local` (ver "Cuentas de prueba" más arriba) ya
la tiene — entrá con esa cuenta a `http://localhost:5173/admin` y vas a
ver el listado de organizaciones, alta de organizaciones nuevas y gestión
de suscripciones.

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
