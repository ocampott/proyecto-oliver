# AGENTS.md

## Contexto

Proyecto en refactor a plataforma multi-tenant (SaaS). La fuente de verdad
del diseño es `docs/superpowers/specs/2026-08-12-whatsapp-saas-platform-design.md`
y el plan de implementación activo está en `docs/superpowers/plans/`.

Este repo es **solo el frontend** (Vite + React + TypeScript, en la raíz —
no hay más subcarpeta `web/`). El backend (Node + Express + TypeScript)
vive en el repo hermano `proyecto-oliver-api`. Ambos se conectan al mismo
proyecto Supabase remoto (Postgres con RLS, Supabase Auth) — no hay stack
local de Supabase ni Docker. Sin tests automatizados — QA manual.

## UI / UX

Línea a seguir en todo lo visual: **Keep it simple**.

- Simple, efectiva y amigable.
- Sencilla de comprender y de navegar para el usuario.
- Sin ornamentación innecesaria: pocas pantallas, pocos pasos, textos
  claros en español rioplatense.
- Preferir componentes planos con Tailwind por sobre librerías de UI
  pesadas o patrones rebuscados.
