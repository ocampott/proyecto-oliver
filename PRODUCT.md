# Product

<!-- impeccable:product-schema 1 -->

## Platform

web

## Users

Dueños y administradores de PyMEs con varias sucursales (ej. panaderías,
comercios) que necesitan controlar la asistencia de sus empleados y
gestionar RRHH básico sin fricción. Los empleados de esas PyMEs son
usuarios secundarios: marcan entrada/salida desde el navegador de su
teléfono, sin instalar nada.

## Product Purpose

Oliver es una plataforma SaaS multi-tenant de control de asistencia,
RRHH (ausencias/licencias/urgencias) y turnos para PyMEs con múltiples
sucursales. Cada organización tiene su propia nómina, sucursales y datos
completamente aislados de otras organizaciones (Postgres + RLS). El éxito
es que un dueño/admin pueda dar de alta su organización, sucursales y
empleados, y operar el día a día (marcado, ausencias, reportes de horas,
cumplimiento de turnos) sin necesitar soporte.

## Positioning

Marcado de asistencia vía QR propio por sucursal, con validación de
geocerca (el empleado debe estar físicamente en la sucursal) y vínculo
dispositivo↔empleado verificado por WhatsApp — a diferencia de un
control de asistencia genérico sin verificación de identidad ni
ubicación. Roadmap del producto: sumar un agente conversacional de
WhatsApp con IA por organización (número de WhatsApp Business propio,
prompt configurable, dashboard de conversaciones) — visión vigente,
pendiente de construir; hoy no existe superficie de WhatsApp en ningún
repo (ni este frontend ni el backend `proyecto-oliver-api`).

## Operating Context

- Multi-tenant real: 1 login = 1 organización (v1). Aislamiento de datos
  por Postgres RLS (`org_id` en toda tabla de negocio).
- Planes por nivel: Gratis (solo Asistencia), Básico (Asistencia + Horas +
  Turnos + RRHH + Reportes), Pro (Básico + límites ilimitados de
  sucursales/empleados), y superadmin (acceso total + panel `/admin` para
  gestionar organizaciones y suscripciones).
- Módulos actuales del frontend: Asistencia, Horas, Turnos (Horarios +
  Cumplimiento), RRHH/Ausencias, Empleados, Sucursales, Configuración,
  Plan, Admin (superadmin: Organizaciones con tabs Miembros/Empleados/
  Sucursales).
- El marcado de asistencia (`/marcar/...`) corre en el navegador del
  empleado usando geolocalización del dispositivo.

## Capabilities and Constraints

- Frontend: Vite + React 19 + TypeScript + Tailwind v4, en la raíz del
  repo (sin subcarpeta `web/`).
- Backend en repo hermano `proyecto-oliver-api` (Node + Express +
  TypeScript), conectado al mismo proyecto Supabase remoto (Postgres +
  RLS + Supabase Auth). No hay stack local de Supabase ni Docker.
- Sin tests automatizados — QA manual.
- Billing/cobros: fuera de alcance v1 (modelo de datos abierto vía campo
  `plan` en `organizations`, sin lógica de cobro implementada).
- Categorías de RRHH: set fijo genérico v1 (no configurable por
  organización todavía).

## Evidence on Hand

Sin clientes reales todavía. Solo existen 4 cuentas de prueba sobre la
base remota compartida (contraseña `demo123456` para todas):
`gratis@test.local`, `basico@test.local`, `pro@test.local`,
`superadmin@test.local`. Ningún testimonio, caso de estudio ni dato de
cliente real debe inventarse.

## Product Principles

- Multi-tenant real con aislamiento estricto de datos por organización.
- Marcado de asistencia verificable: geocerca + identidad ligada a
  WhatsApp, no solo un check-in genérico.
- Simplicidad operativa: pocas pantallas, pocos pasos, para que un
  dueño de PyME opere sin soporte.
- Producto agnóstico de hosting; toda la persistencia vive en Supabase.
- Extensible sin migrar estructura (roles, categorías de RRHH, agente de
  WhatsApp) — el modelo de datos ya lo contempla.

## Accessibility & Inclusion

Sin requerimiento de accesibilidad específico confirmado todavía.
