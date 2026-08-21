# Oliver

Plataforma multi-tenant (SaaS) para control de asistencia. Este repo tiene
el **frontend** (`web/`, Vite + React). 
El **backend** (Node + Express +
TypeScript) vive en el repo hermano
[`proyecto-oliver-api`](../proyecto-oliver-api), conectado a Supabase
(Postgres con Row Level Security + Supabase Auth). Cada cliente tiene su
propia organización con datos completamente aislados.

## Requisitos

- Node.js >= 22.5.0
- El repo `proyecto-oliver-api` (backend) levantado por separado — ver su
  propio README.

## Setup rápido

```bash
# 1. Instalar dependencias
npm install --prefix web

# 2. Crear el archivo de variables de entorno
cp web/.env.example web/.env.local
# Completar con los valores reales (te los pasa quien te invitó)
# VITE_API_URL debe apuntar al backend de proyecto-oliver-api
# (http://localhost:3001 por default)

# 3. Levantar el backend en paralelo (ver README de proyecto-oliver-api)

# 4. Levantar el frontend
npm run dev --prefix web
```

Después entrá a `http://localhost:5173` y logueate con una de las
**cuentas de prueba** de la sección de abajo. Si tu usuario tiene rol de
platform admin (la cuenta `superadmin`, ver más abajo), el panel de
superadmin está en `http://localhost:5173/admin` — sin link en el nav,
acceso directo por URL.

## Cuentas de prueba

La base remota compartida tiene 4 cuentas listas para probar cada nivel
de plan, contraseña `demo123456` para todas:

| Email | Plan | Qué podés probar |
|---|---|---|
| `gratis@test.local` | Gratis | Solo el módulo de Asistencia — el resto (Horas, RRHH, Turnos) debería estar bloqueado |
| `basico@test.local` | Básico | Asistencia + Horas + Turnos + RRHH + Reportes |
| `pro@test.local` | Pro | Todo lo del plan Básico + límites ilimitados de sucursales/empleados |
| `superadmin@test.local` | — (superadmin) | Acceso total sin límites de ningún plan, más el panel `/admin` para gestionar organizaciones y suscripciones |

Cada una es dueña de su propia organización (un usuario pertenece a una
sola org), así que no hace falta invitar ni cambiar de cuenta para probar
el resto del panel — usá la que corresponda a lo que estés probando.

## Variables de entorno

`web/.env.local` tiene sus propias variables — ver `web/.env.example`. Es
**requerido** (no opcional): `web/src/lib/supabase.ts` tira una excepción
al cargar el módulo si faltan `VITE_SUPABASE_URL` / `VITE_SUPABASE_ANON_KEY`,
lo que rompe toda la SPA.

`VITE_API_URL` tiene que apuntar al backend corriendo (`proyecto-oliver-api`,
default `http://localhost:3001`).

## Correr todo en dev

Este repo y `proyecto-oliver-api` se levantan por separado, cada uno con su
propio `npm run dev`:

```bash
# En proyecto-oliver-api/
npm run dev

# En proyecto-oliver/web/ (este repo)
npm run dev --prefix web
```

## Probar el marcado de asistencia localmente

1. Entrá con un usuario que tenga una organización (ver "Cuentas de
   prueba" arriba, o creá la tuya).
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
cuenta `superadmin@test.local` (ver "Cuentas de prueba" más arriba) ya la
tiene — entrá con esa cuenta a `http://localhost:5173/admin` y vas a ver
el listado de organizaciones, alta de organizaciones nuevas y gestión de
suscripciones.

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
  (organización + superadmin) y el flujo público `/marcar` vivieron en
  `web/` (Vite + React) + `server/` (Fastify), con el sistema de diseño
  "Modernist" aplicado. Detalle de las 5 etapas en
  `docs/superpowers/plans/` y `docs/superpowers/specs/` (archivos
  `vite-migra*`).
- **Separación del backend a repo propio (hecho)**: el backend se migró de
  Fastify (`server/`, en este repo) a Express en el repo hermano
  `proyecto-oliver-api`, conectado a Supabase remoto. Este repo quedó solo
  con el frontend.

## Estructura

- `web/` — frontend (Vite + React + TypeScript + Tailwind v4)

El backend, las migraciones de base y los scripts de seed viven en el repo
hermano [`proyecto-oliver-api`](../proyecto-oliver-api).
