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
.env.local
.env

# Completar con los valores reales
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

## Correr todo en dev

Este repo y `proyecto-oliver-api` se levantan por separado, cada uno con su
propio `npm run dev`:

```bash
# En proyecto-oliver-api/
npm run dev

# En proyecto-oliver/web/ (este repo)
npm run dev
```
