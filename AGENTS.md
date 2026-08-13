# AGENTS.md

## Contexto

Proyecto en refactor a plataforma multi-tenant (SaaS). La fuente de verdad
del diseño es `docs/superpowers/specs/2026-08-12-whatsapp-saas-platform-design.md`
y el plan de implementación activo está en `docs/superpowers/plans/`.

Stack: Next.js 15 (App Router) + TypeScript + Supabase (Postgres con RLS,
Supabase Auth). Tests con Vitest (`npm test`). Desarrollo local contra el
stack local de Supabase (`npx supabase start`).

## UI / UX

Línea a seguir en todo lo visual: **Keep it simple**.

- Simple, efectiva y amigable.
- Sencilla de comprender y de navegar para el usuario.
- Sin ornamentación innecesaria: pocas pantallas, pocos pasos, textos
  claros en español rioplatense.
- Preferir componentes planos con Tailwind por sobre librerías de UI
  pesadas o patrones rebuscados.
