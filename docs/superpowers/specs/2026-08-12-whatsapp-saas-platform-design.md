# Rediseño a plataforma multi-tenant — Agente WhatsApp + Asistencia

Fecha: 2026-08-12
Estado: en revisión

## 1. Contexto

El proyecto actual es un bot de WhatsApp con IA (Baileys + OpenRouter) más un
módulo de control de asistencia (marcado de entrada/salida por QR con
validación de geolocalización), construido a medida para un único cliente
(Panadería San Cayetano II): nómina de empleados hardcodeada, prompt de
sistema con el nombre y reglas de ese negocio específico, cookie de sesión
`sanca_session`, y un flujo de RRHH (ausencias/licencias/urgencias) atado a
los menúes conversacionales de ese cliente.

El objetivo de este rediseño es convertir esto en un **producto multi-tenant
que se pueda vender como servicio a distintos clientes**, cada uno con su
propia organización, su propio número de WhatsApp, su propia nómina y
sucursales, y sus propios datos completamente aislados del resto.

Este documento cubre el diseño técnico completo. La implementación se
plantea en un plan aparte (`writing-plans`) una vez aprobado este spec.

## 2. Alcance

### Dentro de alcance (v1)

1. **Multi-tenancy real**: organizaciones, cuentas de usuario propias por
   organización, aislamiento de datos por Postgres RLS.
2. **Agente conversacional de WhatsApp con IA**, por organización:
   conexión de WhatsApp Business (Cloud API oficial), prompt de sistema
   configurable por organización, dashboard de conversaciones, modo IA /
   Humano.
3. **Módulo de asistencia multi-sucursal**, generalizado por organización:
   alta de sucursales (con geocerca) y empleados, marcado de entrada/salida
   vía QR propio (no ligado a WhatsApp), validación de que quien marca es
   quien dice ser (vínculo dispositivo↔empleado verificado por WhatsApp),
   validación de que está físicamente en la sucursal (geocerca), reporte de
   horas trabajadas, y auditoría de intentos rechazados/pendientes.
4. **Panel de superadmin básico**: listar y gestionar organizaciones (para
   que vos des de alta clientes manualmente al principio).

### Fuera de alcance (v1) — se elimina del código actual

- El flujo conversacional de RRHH (`rrhh-flow.ts`, rutas y página `/rrhh`):
  notificación de ausencias/licencias/urgencias a Administración vía menú de
  chat. Es un proceso de negocio específico de un cliente, no una feature
  genérica pedida para el producto. **Supuesto a confirmar**: si en
  realidad querés esto también como feature genérica (igual que pasó con
  asistencia), avisame antes de implementar y lo generalizamos del mismo
  modo.
- Billing / cobros — se deja el modelo de datos abierto para sumarlo después
  (tabla `organizations` con campo `plan`), pero no se implementa lógica de
  cobro en v1.
- Selección de infraestructura de hosting (Vercel, Docker/VPS, etc.) — se
  decide en una etapa aparte. Este diseño es agnóstico de hosting: un solo
  proceso Next.js sin estado propio (toda la persistencia vive en
  Supabase), así que queda "listo" para esa decisión sin bloquearla.

## 3. Arquitectura general

Hoy el sistema son **dos procesos**: el bot (`start:bot`, socket persistente
de Baileys) y el dashboard (`next dev`/`next start`), coordinados por PM2.
Eso existe únicamente porque Baileys necesita mantener una conexión
WebSocket persistente con WhatsApp.

Con WhatsApp Cloud API eso desaparece: Meta llama a un **webhook HTTP**
cuando llega un mensaje, y enviar un mensaje es un `POST` a la Graph API de
Meta. No hace falta ningún proceso de larga duración.

**Resultado: una sola app Next.js**, sin PM2, sin `ecosystem.config.js`, sin
`Procfile`/`nixpacks.toml`, sin `concurrently`. Todo el estado vive en
Supabase (Postgres + Auth).

```
Cliente WhatsApp ──► Meta Cloud API ──► POST /api/webhooks/whatsapp ──► Next.js
                                                                           │
                                                          resuelve org por │
                                                          phone_number_id  │
                                                                           ▼
                                                  LLM (OpenRouter) o cola humana
                                                                           │
                                                                           ▼
                                                        Postgres (Supabase, RLS)
                                                                           │
Dashboard (Next.js, misma app) ◄── Supabase Auth (sesión) ────────────────┘

QR de sucursal ──► navegador del empleado ──► /marcar/[org]/[sucursal]
                                                        │
                                          geolocalización del navegador
                                                        │
                                          (1ª vez) OTP enviado por WhatsApp
                                          Cloud API para vincular dispositivo
                                                        │
                                                        ▼
                                                Postgres (Supabase, RLS)
```

## 4. Modelo de datos (Postgres / Supabase)

Todas las tablas de negocio llevan `org_id` y quedan protegidas por RLS
(una política que exige `org_id = auth org del usuario` para cualquier
lectura/escritura vía el cliente de Supabase). El acceso desde rutas de
servidor (webhooks, envío de OTP) usa la service role key, que no está
sujeta a RLS, y aplica el filtro de `org_id` explícitamente en cada query.

- **organizations**: `id`, `name`, `slug`, `plan`, `created_at`.
- **org_members**: `user_id` (uid de Supabase Auth), `org_id`, `role`
  (`owner` | `admin` | `agent`, enum pensado para sumar roles después sin
  migrar estructura).
- **org_settings**: `org_id`, `system_prompt`, `llm_model`, `bot_name`, etc.
  Reemplaza el `system-prompt.ts` hardcodeado — editable desde el
  dashboard.
- **whatsapp_connections**: `org_id`, `phone_number_id`, `waba_id`,
  `access_token` (cifrado), `display_phone_number`, `status`.
- **conversations**: `org_id`, `contact_phone`, `mode` (`ai`/`human`),
  `created_at`, `updated_at`.
- **messages**: `conversation_id`, `role`, `content`, `whatsapp_message_id`
  (para dedupe de reintentos de webhook), `created_at`.
- **sucursales**: `org_id`, `nombre`, `lat`, `lon`, `radio_metros`.
- **empleados**: `org_id`, `nombre`, `celular`, `device_token` (vínculo
  dispositivo↔empleado, reemplaza el `jid` de Baileys), `activo`.
- **asistencia**: `org_id`, `empleado_id`, `sucursal_id`, `tipo`
  (`entrada`/`salida`), `lat`, `lon`, `created_at`. (equivalente directo a
  la tabla actual, con `org_id` y `empleado_id` como FK en vez de nombre
  suelto).
- **asistencia_rechazada**: igual que hoy — auditoría de intentos
  fallidos, con `motivo` (`fuera_de_rango`, `sucursal_sin_gps`,
  `dispositivo_no_vinculado`, etc.).
- **otp_codes**: `empleado_id`, `code_hash`, `expires_at`, `used_at` — para
  el paso de vinculación de dispositivo (ver §6).

## 5. Módulo 1 — Agente conversacional de WhatsApp con IA

- Se reemplaza `src/lib/baileys/*` completo por una capa de interfaz
  `MessagingChannel` (`send`, `receiveWebhook`) con una única
  implementación real: `WhatsAppCloudChannel`. El resto del código (LLM,
  conversaciones, dashboard) depende de la interfaz, no de Baileys — así
  sumar otro canal el día de mañana es agregar una implementación, no
  reescribir el core.
- `POST /api/webhooks/whatsapp`: recibe el mensaje, resuelve la
  organización por `phone_number_id`, guarda el mensaje, y si el modo de la
  conversación es `ai`, genera respuesta vía `src/lib/openrouter.ts`
  (adaptado para leer el prompt desde `org_settings` en vez de un archivo
  TS) y la envía de vuelta. `GET` del mismo endpoint atiende el handshake
  de verificación de Meta (`hub.challenge`).
- Onboarding: pantalla en el dashboard que dispara el **Embedded Signup**
  de Meta — el cliente conecta su número de WhatsApp Business sin que
  manipules tokens a mano; el resultado (phone_number_id, token) se guarda
  en `whatsapp_connections`.
- Dashboard: se reutilizan `ConversationList`, `ConversationPanel`,
  `MessageBubble`, `ModeToggle`, adaptados para filtrar por `org_id` de la
  sesión activa.
- Envío de mensajes "humanos" desde el dashboard: se llama directo a la
  Graph API en el mismo request (ya no hace falta el poller de outbox cada
  2s, porque no hay proceso de bot separado). Si falla, se reintenta o se
  marca el mensaje como fallido para reintento manual — sin colas
  complejas en v1.

## 6. Módulo 2 — Asistencia multi-sucursal

Generaliza el módulo actual (que ya tiene la base correcta: QR propio +
geocerca Haversine) para que sea por-organización y cierre el único punto
débil real que tiene hoy.

**Diagnóstico del sistema actual** (confirmado leyendo el código): la
identidad ya queda atada de forma permanente al primer WhatsApp `jid` que
marca con un nombre válido (`vincularEmpleadoJid`), y cualquier intento
posterior desde otro número con el mismo nombre se rechaza automáticamente.
El único momento sin protección es **el momento de vinculación** (alta
inicial, o después de que un admin desvincula manualmente un dispositivo):
en ese instante, cualquiera que tipee el nombre correcto se queda con la
identidad, sin probar que es esa persona.

**Diseño v1**:

1. Admin da de alta sucursales (`nombre`, `lat`, `lon`, `radio_metros`) y
   empleados (`nombre`, `celular`) desde el dashboard.
2. El QR de cada sucursal (generado por nuestra propia API con la librería
   `qrcode`, igual que hoy) apunta a una página web propia:
   `/marcar/[org]/[sucursal]` — **no** abre WhatsApp.
3. El empleado escribe su nombre. Se valida contra la nómina de esa
   organización (reutilizando la lógica de matching exacto/aproximado que
   ya existe en `validarEmpleadoDB`/Levenshtein).
4. Si ese empleado no tiene un `device_token` vinculado todavía: se genera
   un código OTP, se guarda hasheado en `otp_codes` con expiración corta, y
   se envía por WhatsApp Cloud API al `celular` registrado del empleado. El
   empleado lo tipea en la web; si coincide y no expiró, se emite un
   `device_token` (cookie firmada de larga duración) atado a ese
   `empleado_id` — vinculación permanente, igual de fuerte que el `jid` de
   hoy pero con prueba real de posesión del teléfono.
5. Visitas siguientes desde el mismo dispositivo: se reconoce por el
   `device_token`, no vuelve a pedir nombre ni OTP — solo pide permiso de
   geolocalización del navegador.
6. Se captura la ubicación, se calcula distancia a la sucursal (fórmula
   Haversine, reutilizada tal cual del código actual) y si está dentro de
   `radio_metros`, se inserta en `asistencia`; si no, en
   `asistencia_rechazada` con el motivo y la distancia (igual que hoy).
7. Cambio de celular: el admin usa un botón "Desvincular" en el dashboard
   (borra el `device_token`) — la próxima vez que ese empleado entre a la
   página, repite el paso 4 (nombre + OTP) para revincular. Nunca se
   revincula sin OTP.
8. Se mantienen las vistas de **horas trabajadas** (cálculo a partir de
   pares entrada/salida, igual que `src/app/api/asistencia/horas`) y
   **pendientes** (intentos que arrancaron pero no llegaron a completar
   ubicación) como parte del mismo módulo, generalizadas por `org_id`.

## 7. Auth y multi-tenancy

- Se reemplaza `src/lib/auth.ts` (HMAC casero) y `src/middleware.ts` por
  **Supabase Auth** (email + contraseña para arrancar).
- El middleware valida la sesión de Supabase y resuelve a qué
  organización(es) pertenece el usuario vía `org_members`. Si pertenece a
  más de una organización, se agrega selector de organización activa (no
  bloqueante para v1 si arrancamos con 1 organización por usuario).
- El aislamiento fuerte entre clientes lo garantiza **RLS de Postgres**, no
  checks manuales en cada endpoint — así un bug de lógica en un endpoint no
  puede filtrar datos de otro cliente.
- `role` en `org_members` ya queda como enum abierto (`owner`/`admin`/
  `agent`) aunque en v1 todos los roles tengan los mismos permisos —
  preparado para diferenciar permisos por rol sin migrar el esquema.

## 8. Panel de superadmin (v1 básico)

- Flag `platform_admin` en el usuario (no una tabla nueva).
- Ruta `/admin` (fuera del layout normal de organización): lista de
  `organizations` con estado de conexión de WhatsApp y fecha de alta.
  Alcance v1: ver y crear organizaciones manualmente. Sin métricas de uso
  ni billing todavía.

## 9. Qué se elimina del código actual

- `src/lib/baileys/*`, `scripts/start-bot.ts`, `scripts/env-loader.ts`
- `ecosystem.config.js`, `Procfile`, `nixpacks.toml`
- `src/lib/rrhh-flow.ts`, rutas `/api/rrhh/*`, página `/rrhh`
- `src/lib/nomina.ts` (nómina hardcodeada — reemplazada por tabla
  `empleados` por organización)
- `src/lib/system-prompt.ts` (prompt hardcodeado — reemplazado por
  `org_settings.system_prompt`, editable desde el dashboard)
- `src/lib/auth.ts`, reescritura completa de `src/middleware.ts`
- `src/lib/db.ts` (1024 líneas, SQLite) — reescrito contra Postgres/
  Supabase con el esquema multi-tenant de §4
- `src/components/QRScreen.tsx`, `src/components/ConnectionGate.tsx`
  (flujo de login QR de Baileys) — reemplazados por la pantalla de
  conexión de Cloud API (Embedded Signup)
- Archivos sueltos sin relación con el producto: `Informe_Sanca_
  SanCayetano.docx`, `CLAUDE PROYECTO.code-workspace`

## 10. Qué se reutiliza / adapta (no se reescribe de cero)

- `src/lib/openrouter.ts` — se adapta para leer el prompt desde
  `org_settings` en vez de un import estático.
- Fórmula Haversine y lógica de geocerca (`handler.ts`) — se traslada tal
  cual a la validación de la nueva página `/marcar`.
- Matching de nombres (exacto + aproximado por Levenshtein) de
  `validarEmpleadoDB`/`buscarEmpleadoParecido` — se traslada a la
  validación de nombre en `/marcar`, ahora scopeado por `org_id`.
- Componentes del dashboard de conversaciones (`ConversationList`,
  `ConversationPanel`, `MessageBubble`, `ModeToggle`, `PageHeader`,
  `DashboardHeader`) — se adaptan para multi-tenant, no se reescriben.
- El patrón de generación de QR con la librería `qrcode` — mismo enfoque,
  cambia el contenido codificado (URL propia en vez de `wa.me`).

## 11. Manejo de errores / casos borde

- **Reintentos de webhook de Meta**: Meta puede reenviar el mismo evento;
  se deduplica por `whatsapp_message_id` antes de procesar.
- **Token de WhatsApp vencido/revocado por el cliente**: se marca
  `whatsapp_connections.status = 'error'` y se muestra alerta en el
  dashboard de esa organización para reconectar.
- **OTP vencido o mal tipeado**: mensaje claro en la web, botón de
  reenviar código (con límite de reintentos para evitar abuso).
- **Sucursal sin geocerca configurada**: se rechaza el marcado con motivo
  `sucursal_sin_gps` (igual que hoy), no se bloquea todo el flujo.
- **Geolocalización denegada por el navegador**: mensaje explicando que es
  obligatoria para marcar asistencia, con instrucciones para habilitarla.
- **Usuario sin organización** (login válido pero sin `org_members`):
  pantalla de "contactá a soporte", no un 500.

## 12. Estrategia de testing

- Unit: fórmula Haversine, matching de nombres (exacto/aproximado), lógica
  de expiración/validación de OTP.
- Integración: políticas RLS (confirmar que un usuario de la organización A
  no puede leer/escribir datos de la organización B ni por la API ni
  directo contra Supabase).
- Integración: verificación de firma del webhook de Meta, dedupe de
  mensajes repetidos.
- E2E manual (mínimo v1): flujo completo de marcado (alta empleado → primer
  marcado con OTP → marcado siguiente sin OTP → rechazo por geocerca).

## 13. Supuestos a confirmar antes de implementar

1. El módulo de RRHH (ausencias/licencias/urgencias vía chat) se elimina en
   v1 y no se generaliza — confirmar que es correcto, o pedirlo como
   feature genérica igual que se hizo con asistencia.
2. Autenticación de dashboard v1: email + contraseña vía Supabase Auth
   (sin SSO/OAuth todavía).
3. Un usuario pertenece a una sola organización en v1 (simplifica el
   selector de organización activa); multi-org por usuario queda abierto
   para después si hace falta.
