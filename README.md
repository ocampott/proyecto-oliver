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

# 4. Aplicar las migraciones
npx supabase db reset

# 5. Levantar el frontend
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
| `OPENROUTER_API_KEY` | API key de OpenRouter (la usa el módulo del agente IA, Plan 2) |
| `OPENROUTER_MODEL` | Modelo a usar (default `openai/gpt-4o-mini`) |

## Estado del refactor

- **Plan 1 — Foundation (hecho)**: multi-tenancy real (`organizations`,
  `org_members`, `org_settings`, `platform_admins`) con RLS probado, login
  con Supabase Auth, panel de superadmin en `/admin`, y repositorio limpio
  del stack anterior (Baileys, SQLite, PM2, código específico de un cliente).
- **Plan 2 — Canal de WhatsApp Cloud API + agente IA**: pendiente.
- **Plan 3 — Módulo de Asistencia**: pendiente.
- **Plan 4 — Módulo de RRHH**: pendiente.

## Estructura

- `src/app` — páginas y route handlers (App Router)
- `src/lib` — lógica de servidor (helpers de organización, clientes de
  Supabase, OpenRouter)
- `supabase/migrations` — migraciones de la base (se aplican con
  `npx supabase db reset`)
- `src/middleware.ts` — verificación de sesión en cada request
