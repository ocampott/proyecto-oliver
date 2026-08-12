# Rediseño a plataforma multi-tenant — Agente WhatsApp + Asistencia + RRHH

Fecha: 2026-08-12
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

El proyecto actual es un bot de WhatsApp con IA (Baileys + OpenRouter) más un
módulo de control de asistencia (marcado de entrada/salida por QR con
validación de geolocalización) y un módulo de RRHH (ausencias/licencias/
urgencias vía chat), construido a medida para un único cliente (Panadería
San Cayetano II): nómina de empleados hardcodeada, prompt de sistema con el
nombre y reglas de ese negocio específico, cookie de sesión `sanca_session`.

El objetivo de este rediseño es convertir esto en un **producto multi-tenant
que se pueda vender como servicio a distintos clientes**, cada uno con su
propia organización, su propio número de WhatsApp, su propia nómina y
sucursales, y sus propios datos completamente aislados del resto.

Este documento cubre el diseño técnico completo. La implementación se
plantea en un plan aparte (`writing-plans`) una vez aprobado este spec.

## 2. Alcance

### Dentro de alcance (v1)

1. **Multi-tenancy real**: organizaciones, cuentas de usuario propias por
   organización (1 login = 1 organización en v1 — ver §7), aislamiento de
   datos por Postgres RLS.
2. **Agente conversacional de WhatsApp con IA**, por organización: un
   número de WhatsApp Business por organización (Cloud API oficial,
   cubre todas sus sucursales), prompt de sistema configurable por
   organización, dashboard de conversaciones, modo IA / Humano.
3. **Módulo de asistencia multi-sucursal**, generalizado por organización:
   alta de sucursales (con geocerca) y empleados, marcado de entrada/salida
   vía QR propio (no ligado a WhatsApp), validación de que quien marca es
   quien dice ser (vínculo dispositivo↔empleado verificado por WhatsApp),
   validación de que está físicamente en la sucursal (geocerca), reporte de
   horas trabajadas, y auditoría de intentos rechazados/pendientes.
4. **Módulo de RRHH multi-sucursal** (ausencias, licencias, urgencias),
   generalizado por organización: mismo concepto que hoy, pero reutilizando
   la nómina/sucursales/vínculo de identidad del módulo de asistencia, y
   guardando las solicitudes como datos estructurados en vez de texto libre
   parseado por regex.
5. **Panel de superadmin básico**: listar y gestionar organizaciones (para
   que vos des de alta clientes manualmente al principio).

### Fuera de alcance (v1)

- Billing / cobros — se deja el modelo de datos abierto para sumarlo después
  (tabla `organizations` con campo `plan`), pero no se implementa lógica de
  cobro en v1.
- Selección de infraestructura de hosting (Vercel, Docker/VPS, etc.) — se
  decide en una etapa aparte. Este diseño es agnóstico de hosting: un solo
  proceso Next.js sin estado propio (toda la persistencia vive en
  Supabase), así que queda "listo" para esa decisión sin bloquearla.
- Categorías de RRHH configurables por organización — v1 usa un set fijo
  genérico (Enfermedad, Motivo Personal, Licencia, Urgencia, igual que
  hoy). Si un cliente necesita categorías propias, queda para una
  iteración posterior (el modelo de datos ya lo soporta sin migrar
  estructura — ver §7).
- Selector de organización activa por usuario y WhatsApp por sucursal — ver
  §7, quedaron descartados para v1 tras la revisión de este spec.

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
                                            LLM (chat) / flujo RRHH / cola humana
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

Un solo número de WhatsApp por organización atiende a todas sus sucursales
(igual que hoy) — la sucursal se resuelve **dentro** de la conversación
(asistencia web) o del flujo (RRHH), no por número de teléfono distinto.

## 4. Modelo de datos (Postgres / Supabase)

Todas las tablas de negocio llevan `org_id` y quedan protegidas por RLS
(una política que exige `org_id = auth org del usuario` para cualquier
lectura/escritura vía el cliente de Supabase). El acceso desde rutas de
servidor (webhooks, envío de OTP) usa la service role key, que no está
sujeta a RLS, y aplica el filtro de `org_id` explícitamente en cada query.

- **organizations**: `id`, `name`, `slug`, `plan`, `created_at`.
- **org_members**: `user_id` (uid de Supabase Auth, único por organización
  en v1 — ver §7), `org_id`, `role` (`owner` | `admin` | `agent`, enum
  pensado para sumar roles después sin migrar estructura).
- **org_settings**: `org_id`, `system_prompt`, `llm_model`, `bot_name`,
  `rrhh_categorias` (jsonb, default con las 4 categorías fijas — abierto a
  personalizar por org sin migrar esquema). Reemplaza el
  `system-prompt.ts` hardcodeado — editable desde el dashboard.
- **whatsapp_connections**: `org_id` (único), `phone_number_id`, `waba_id`,
  `access_token` (cifrado), `display_phone_number`, `status`.
- **conversations**: `org_id`, `contact_phone`, `mode` (`ai`/`human`),
  `created_at`, `updated_at`.
- **messages**: `conversation_id`, `role`, `content`, `whatsapp_message_id`
  (para dedupe de reintentos de webhook), `created_at`.
- **sucursales**: `org_id`, `nombre`, `lat`, `lon`, `radio_metros`.
  Compartida por Asistencia y RRHH.
- **empleados**: `org_id`, `nombre`, `celular`, `device_token` (vínculo
  dispositivo↔empleado, reemplaza el `jid` de Baileys), `activo`.
  Compartida por Asistencia y RRHH — un solo vínculo de identidad por
  empleado, sea cual sea el módulo que lo estableció primero (ver §7).
- **asistencia**: `org_id`, `empleado_id`, `sucursal_id`, `tipo`
  (`entrada`/`salida`), `lat`, `lon`, `created_at`.
- **asistencia_rechazada**: auditoría de intentos fallidos, con `motivo`
  (`fuera_de_rango`, `sucursal_sin_gps`, `dispositivo_no_vinculado`, etc.).
- **otp_codes**: `empleado_id`, `canal` (`asistencia_web` | `rrhh_chat`),
  `code_hash`, `expires_at`, `used_at` — vinculación de identidad,
  reutilizada por ambos módulos.
- **rrhh_solicitudes**: `org_id`, `empleado_id`, `sucursal_id`,
  `categoria`, `fecha_inicio`, `fecha_fin`, `detalle`, `certificado_url`
  (Supabase Storage, nullable), `certificado_pendiente` (bool), `estado`
  (`pendiente` | `revisado`), `created_at`. Reemplaza el parseo por regex
  de bloques `<ADMIN>` en texto libre que hace hoy `/api/rrhh`.

## 5. Módulo 1 — Agente conversacional de WhatsApp con IA

- Se reemplaza `src/lib/baileys/*` completo por una capa de interfaz
  `MessagingChannel` (`send`, `receiveWebhook`) con una única
  implementación real: `WhatsAppCloudChannel`. El resto del código (LLM,
  conversaciones, dashboard) depende de la interfaz, no de Baileys — así
  sumar otro canal el día de mañana es agregar una implementación, no
  reescribir el core.
- `POST /api/webhooks/whatsapp`: recibe el mensaje, resuelve la
  organización por `phone_number_id`, guarda el mensaje, y enruta:
  si hay un flujo de asistencia/RRHH pendiente para ese teléfono continúa
  ahí; si no, y el modo de la conversación es `ai`, genera respuesta vía
  `src/lib/openrouter.ts` (adaptado para leer el prompt desde
  `org_settings`) y la envía de vuelta. `GET` del mismo endpoint atiende
  el handshake de verificación de Meta (`hub.challenge`).
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
   hoy pero con prueba real de posesión del teléfono. Este vínculo es el
   mismo que usa el módulo de RRHH (§7) — quien lo establece primero, lo
   deja hecho para ambos.
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

## 7. Módulo 3 — RRHH multi-sucursal (ausencias, licencias, urgencias)

Se mantiene como feature core (no se elimina) y se generaliza igual que
Asistencia: cada organización tiene su propio módulo de RRHH, reutilizando
la nómina y sucursales ya cargadas para Asistencia — no se duplica alta de
empleados por módulo.

**Identidad**: a diferencia de Asistencia (que ocurre en una web fuera de
WhatsApp), RRHH ocurre **dentro** de una conversación de WhatsApp — el
número ya está verificado por el canal en sí. Se reutiliza el mismo vínculo
`empleados.device_token`/`celular` del módulo de Asistencia:
- Si el empleado ya tiene vínculo establecido (por Asistencia o por un RRHH
  previo), se reconoce directo por su número de WhatsApp, sin pedir nombre.
- Si es la primera vez que ese empleado interactúa con el bot por
  cualquiera de los dos módulos, se establece el vínculo ahí mismo (nombre
  válido en la nómina + ese número → vínculo permanente), sin necesidad de
  un OTP adicional porque el canal WhatsApp ya prueba la posesión del
  teléfono.
- Un número que intenta usar un nombre ya vinculado a otro número se
  rechaza, igual que hoy.

**Flujo** (reutiliza el patrón de máquina de estados persistente en
`flow_state`, ya genérico por teléfono+flow, solo se agrega `org_id`):

1. Identificación (ver arriba) → selección de sucursal (de la lista de
   sucursales de esa organización).
2. Menú de categorías — v1 usa el set fijo: Enfermedad, Motivo Personal,
   Licencia, Urgencia (configurable por organización a futuro vía
   `org_settings.rrhh_categorias`, no bloqueante para v1).
3. Sub-flujo pidiendo fecha de inicio, fecha de fin y detalle. Se reutiliza
   `parseDetalle` de `openrouter.ts` para extraer estos campos de texto
   libre — el LLM se usa para **parsear**, no para decidir el flujo (igual
   que hoy).
4. Si la categoría es Enfermedad, se pregunta por certificado médico; si
   corresponde, se espera el adjunto (imagen/PDF vía mensaje de WhatsApp) y
   se sube a Supabase Storage, guardando la URL en `rrhh_solicitudes`.
5. Al completar el flujo, se inserta un registro estructurado en
   `rrhh_solicitudes` (§4) — **no** se genera un bloque de texto
   `<ADMIN>...</ADMIN>` para parsear después con regex (como hoy), que es
   fràgil y depende de la redacción exacta del prompt de un cliente
   puntual.

**Notificación a Administración**: por default en v1, las solicitudes
aparecen en una bandeja del dashboard (`/rrhh`, leyendo `rrhh_solicitudes`
directo, sin parseo de texto) — no se reenvían automáticamente por
WhatsApp. Motivo: WhatsApp Business API restringe los mensajes salientes
iniciados por el negocio fuera de una conversación activa a plantillas
pre-aprobadas por Meta; depender de eso para cada aviso suma fricción
operativa (aprobación de templates) que no hace falta para v1, ya que el
dashboard cumple la misma función de forma inmediata y confiable. Un aviso
proactivo por WhatsApp queda como mejora posible más adelante, si algún
cliente lo pide.

## 8. Auth y multi-tenancy

- Se reemplaza `src/lib/auth.ts` (HMAC casero) y `src/middleware.ts` por
  **Supabase Auth** (email + contraseña para arrancar).
- El middleware valida la sesión de Supabase y resuelve la organización del
  usuario vía `org_members`.
- **Decisión confirmada**: un usuario (login) pertenece a una sola
  organización en v1 — no hay selector de organización activa. El modelo
  de datos (`org_members`) ya soporta muchos-a-muchos, así que sumar
  multi-organización por usuario más adelante es agregar UI, no migrar
  esquema. Para administrar múltiples clientes como dueño del producto, se
  usa el panel de superadmin (§9), no un login "como" cada cliente.
- El aislamiento fuerte entre clientes lo garantiza **RLS de Postgres**, no
  checks manuales en cada endpoint — así un bug de lógica en un endpoint no
  puede filtrar datos de otro cliente.
- `role` en `org_members` ya queda como enum abierto (`owner`/`admin`/
  `agent`) aunque en v1 todos los roles tengan los mismos permisos —
  preparado para diferenciar permisos por rol sin migrar el esquema.

## 9. Panel de superadmin (v1 básico)

- Flag `platform_admin` en el usuario (no una tabla nueva).
- Ruta `/admin` (fuera del layout normal de organización): lista de
  `organizations` con estado de conexión de WhatsApp y fecha de alta.
  Alcance v1: ver y crear organizaciones manualmente. Sin métricas de uso
  ni billing todavía.

## 10. Qué se elimina del código actual

- `src/lib/baileys/*`, `scripts/start-bot.ts`, `scripts/env-loader.ts`
- `ecosystem.config.js`, `Procfile`, `nixpacks.toml`
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
- El parseo por regex de bloques `<ADMIN>` en `/api/rrhh/route.ts` — se
  reemplaza por lectura directa de `rrhh_solicitudes` (§7)
- Archivos sueltos sin relación con el producto: `Informe_Sanca_
  SanCayetano.docx`, `CLAUDE PROYECTO.code-workspace`

## 11. Qué se reutiliza / adapta (no se reescribe de cero)

- `src/lib/openrouter.ts` — se adapta para leer el prompt desde
  `org_settings` en vez de un import estático; `parseDetalle` se reutiliza
  tal cual para el sub-flujo de RRHH.
- Fórmula Haversine y lógica de geocerca (`handler.ts`) — se traslada tal
  cual a la validación de la nueva página `/marcar`.
- Matching de nombres (exacto + aproximado por Levenshtein) de
  `validarEmpleadoDB`/`buscarEmpleadoParecido` — se traslada a Asistencia y
  RRHH, ahora scopeado por `org_id`.
- La máquina de estados persistente en `flow_state` (ya genérica por
  teléfono+nombre de flow) — se reutiliza para RRHH, se suma `org_id`.
- Componentes del dashboard de conversaciones (`ConversationList`,
  `ConversationPanel`, `MessageBubble`, `ModeToggle`, `PageHeader`,
  `DashboardHeader`) — se adaptan para multi-tenant, no se reescriben.
- El patrón de generación de QR con la librería `qrcode` — mismo enfoque,
  cambia el contenido codificado (URL propia en vez de `wa.me`).

## 12. Manejo de errores / casos borde

- **Reintentos de webhook de Meta**: Meta puede reenviar el mismo evento;
  se deduplica por `whatsapp_message_id` antes de procesar.
- **Token de WhatsApp vencido/revocado por el cliente**: se marca
  `whatsapp_connections.status = 'error'` y se muestra alerta en el
  dashboard de esa organización para reconectar.
- **OTP vencido o mal tipeado**: mensaje claro, botón de reenviar código
  (con límite de reintentos para evitar abuso).
- **Sucursal sin geocerca configurada**: se rechaza el marcado con motivo
  `sucursal_sin_gps` (igual que hoy), no se bloquea todo el flujo.
- **Geolocalización denegada por el navegador**: mensaje explicando que es
  obligatoria para marcar asistencia, con instrucciones para habilitarla.
- **Usuario sin organización** (login válido pero sin `org_members`):
  pantalla de "contactá a soporte", no un 500.
- **Adjunto de certificado médico que falla al subir**: la solicitud de
  RRHH queda igual con `certificado_pendiente = true`, no se pierde el
  resto de los datos ya cargados.

## 13. Estrategia de testing

- Unit: fórmula Haversine, matching de nombres (exacto/aproximado), lógica
  de expiración/validación de OTP, parseo de fechas/detalle en RRHH.
- Integración: políticas RLS (confirmar que un usuario de la organización A
  no puede leer/escribir datos de la organización B ni por la API ni
  directo contra Supabase).
- Integración: verificación de firma del webhook de Meta, dedupe de
  mensajes repetidos.
- E2E manual (mínimo v1):
  - Asistencia: alta empleado → primer marcado con OTP → marcado siguiente
    sin OTP → rechazo por geocerca.
  - RRHH: primer contacto vincula identidad → solicitud completa con
    certificado → aparece en la bandeja del dashboard.
