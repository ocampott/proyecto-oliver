# Pixel-perfect Modernist — retrofit fino sobre todo `web/`

Fecha: 2026-08-19
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

El retrofit de la Etapa 4 (`docs/superpowers/specs/2026-08-18-vite-migration-etapa4-design.md`
§3.3) llevó los **tokens** de Modernist (acento azul `#1d4ed8`, radio 0,
fuente Archivo) a `web/src/index.css`, y con eso todo el panel dejó de
verse rojo/redondeado. Pero los **componentes** (`web/src/components/ui/*`)
y las 8 pantallas nunca se compararon en detalle contra el mockup real —
se construyeron con aproximaciones Tailwind razonables pero no fieles. El
usuario reporta que hoy navbar, formularios y demás "no se ven como el
mock" — correcto: solo cambiaron los colores, no la estructura de los
componentes.

Esta etapa cierra esa brecha: pasada pixel-perfect sobre las 8 pantallas
ya migradas a `web/` (Login, Home, Sucursales, Empleados, Asistencia,
Horas, Marcar público, Admin) + los 2 modales (Ver QR, Generar código),
usando como fuente de verdad el mismo proyecto Claude Design de la Etapa
4: `8f3e8aba-017d-4ccb-942e-1d6234146c10`, archivo
`design_handoff_ui_oliver/Oliver - UI Completa.dc.html` +
`design_handoff_ui_oliver/_ds/modernist-.../styles.css` (tokens/clases de
referencia). Releer ambos vía `DesignSync get_file` antes de implementar —
no re-derivar valores de memoria.

## 2. Decisiones tomadas con el usuario

- **Sin theming por organización.** El mock tiene props editables
  `accentColor`/`density` ("Tema por organización") — son controles del
  canvas de Claude Design para previsualizar variantes, no una feature
  real pedida en ningún spec anterior. Acento fijo `#1d4ed8`, densidad
  "cómoda" fija (el equivalente a `cellPad: 12px` del mock).
- **Se mantiene el patrón Tailwind + `cva`** de `web/src/components/ui/*`
  en vez de portar las clases CSS crudas del mock (`.btn`, `.field`,
  `.dialog`, etc.) tal cual. Se toman los valores exactos de
  `styles.css` (spacing, tamaños, pesos, colores) y se lo lleva a los
  `cva` variants existentes — evita tener dos sistemas de estilos
  conviviendo en el repo.
- **"Ver QR" y "Generar código" pasan a ser modales reales** (backdrop +
  panel centrado, componente `Dialog` nuevo) en vez del panel inline
  actual (Sucursales) o la ausencia total de feedback modal (Empleados,
  donde el código solo aparece como tag en la fila). El mock los diseña
  explícitamente como modales (sección "05 — Modales" del `.dc.html`).
- **Sin tests automatizados nuevos** — verificación manual (build +
  pasada visual del usuario en el navegador), mismo criterio que toda la
  migración a Vite.

## 3. Gaps encontrados (auditoría contra el mock)

- **Botones (`components/ui/button.tsx`)**: el mock usa
  `font-family: var(--font-heading)` peso 800 en **todos** los botones
  (`.btn`), tamaño 14px. El componente actual usa `font-normal` — cambia
  el look de bold/arquitectónico a fino en toda la app. Variants del mock:
  `btn-primary` (fondo acento sólido), `btn-secondary` (contorno con
  `--color-divider`), `btn-ghost` (solo texto, color acento-700, sin
  fondo/borde), `btn-icon` (36×36, sin padding), `btn-block` (100% ancho,
  contenido flush-left salvo que se pida centrado). Los variants actuales
  (`default`/`outline`/`accent`/`ghost`) no mapean 1:1 — hay que
  realinearlos a los cuatro del mock.
- **Forms (`components/ui/input.tsx`)**: el mock siempre envuelve el
  input en `.field` con un `<label>` visible arriba (12px, texto
  atenuado). Hoy los inputs son standalone con solo `placeholder`, sin
  label — afecta Login, Sucursales, Empleados, Asistencia, Horas, Marcar.
  Falta un componente `Field` (label + input) nuevo.
- **Nav (`components/PanelNav.tsx`)**: el mock tiene wordmark "Oliver"
  (`.nav-brand`, 18px peso 800) + `position: sticky` + el link activo en
  color acento (`aria-current="page"`, no solo bold) + el conjunto vive
  dentro de un `.nav` con `border-bottom: 2px`. El nav actual no tiene
  marca, no es sticky, y el estado activo es solo `font-extrabold` sin
  cambio de color.
- **Cards (`components/ui/card.tsx`, usado en Home)**: el mock especifica
  `.card` con padding 22px (actual: 24px, cerca pero no exacto),
  `card-title` 17px peso 800 (actual: 15px), `card-body` 13px opacidad
  .8 (actual: 15px), ícono 22×22 en acento-700 con `margin-bottom: 4px`.
- **Estados en tabla (Sucursales "Activa", Empleados "Activo"/
  "Dispositivo")**: el mock siempre usa `.tag` (componente `Badge`
  existente) para estos valores — tinta llena para "Sí"/vinculado,
  contorno para pendiente, neutral para "No"/sin vincular. Hoy Sucursales
  y Empleados muestran texto plano ("Sí"/"No"/"Vinculado"/"Sin vincular")
  sin badge; Asistencia y Horas ya usan `Badge` correctamente y sirven de
  referencia de patrón correcto dentro del propio repo.
- **Login**: la card no tiene el borde 2px (`border: 2px solid
  var(--color-divider)`) que especifica el mock sobre `--color-surface`.
- **Modales (Ver QR / Generar código)**: no existe componente `Dialog`
  (backdrop fijo + panel centrado `max-width: 440px`). "Ver QR" hoy es un
  panel inline debajo de la tabla de Sucursales; "Generar código" no
  muestra ningún modal — el código de 6 dígitos solo se ve como tag en la
  fila de Empleados (ese tag sí matchea el mock y se mantiene: el modal
  es un feedback *adicional* al generar, no un reemplazo).
- **Marcar público (`MarcarPage.tsx`)**: mismos gaps de botones/tags que
  el resto; revisar en el plan que los íconos usados (`log-in`, `log-out`,
  `check-circle`, `triangle-alert`, `rotate-ccw`, `arrow-right`) estén
  presentes y con los tamaños del mock (18px en los botones grandes de
  marcar, 28px en el ícono de alerta de rechazo).
- **Admin (`AdminPage.tsx`)**: no tiene pantalla propia en el mock (es
  posterior a la Etapa 4/al handoff de diseño) — se lleva a los mismos
  componentes ya corregidos (`Button`, `Field`, `Table`, `Badge`) para
  quedar consistente con el resto, sin una referencia pixel-a-pixel
  específica del mock para esta pantalla.

## 4. Arquitectura

### 4.1 Componentes compartidos (`web/src/components/ui/*`)

- **`button.tsx`**: variants reescritos a `primary` (bg acento, ex
  `accent`), `secondary` (ex `outline`, contorno divider), `ghost` (color
  acento-700 sin fondo), más flags `block` (100% ancho) e `icon` (36×36).
  Peso 800 (`font-extrabold` de Tailwind) y tamaño 14px en todos. El
  variant `default` (bg-text/text-bg) se elimina — su único uso hoy es
  "Descargar PNG" en el modal de QR, que el mock define como `btn-primary
  btn-block`; pasa a ese variant.
- **`field.tsx`** (nuevo): envuelve `label` + `Input` existente,
  reexporta `Input` para los pocos casos sin label (si los hay tras la
  auditoría del plan).
- **`card.tsx`**: ajustar padding/tamaños a los valores exactos de
  `.card`/`.card-title`/`.card-body` de `styles.css`.
- **`badge.tsx`**: ya modela bien `.tag`/`tag-accent`/`tag-outline`
  (usado en Asistencia/Horas) — solo falta adoptarlo en Sucursales/
  Empleados, no rediseñarlo.
- **`dialog.tsx`** (nuevo): backdrop fijo (`position: fixed; inset: 0`,
  fondo `color-mix` sobre `--color-neutral-900` al 50%) + panel centrado
  (`max-width: 440px`, `background: var(--color-surface)`), título +
  botón "Cerrar" (`btn-ghost`) en la cabecera, `dialog-actions` con los
  CTA alineados a la derecha (o `btn-block` cuando el mock lo pide, como
  en "Descargar PNG"). Cierra con click en el backdrop y `Escape`.

### 4.2 Nav (`components/PanelNav.tsx` / `components/PanelLayout.tsx`)

Agregar wordmark "Oliver" (`.nav-brand` — peso 800, 18px, `margin-right:
auto` para empujar los links a la derecha), `position: sticky; top: 0`,
y el link activo en `text-accent-700` en vez de solo bold.

### 4.3 Pantallas

Cada pantalla se retoca in-place (mismo archivo, misma lógica de
`hooks.ts`/`api.ts` — **cero cambios de comportamiento salvo los modales
del §4.4**): reemplazar los `<input>` sueltos por `Field`, adoptar
`Badge` donde falta, ajustar tamaños de texto/spacing a los del mock
(`h1` 28-32px según pantalla, `h3` de sección 20-25px), y los botones
al nuevo mapeo de variants.

Pantallas: `LoginPage.tsx`, `HomePage.tsx`,
`pages/sucursales/SucursalesPage.tsx`, `pages/empleados/EmpleadosPage.tsx`,
`pages/asistencia/AsistenciaPage.tsx`, `pages/horas/HorasPage.tsx`,
`MarcarPage.tsx`, `pages/admin/AdminPage.tsx`.

### 4.4 Modales

- **Ver QR** (Sucursales): reemplaza el panel inline por `Dialog`. Mismo
  contenido (preview del QR, URL, botón "Descargar PNG" `btn-primary
  btn-block`), mismo estado (`qrId`/`useQrBlob`) — solo cambia el
  contenedor visual y que ahora se puede cerrar con backdrop/Escape.
- **Generar código** (Empleados): al completar `useGenerarOtp`, abrir un
  `Dialog` con el código grande (40px, letter-spacing .15em) y el texto
  "Vence en 10 minutos. Dictáselo a {nombre}." — feedback inmediato
  además del tag que ya queda en la fila tras cerrar el modal.

## 5. Fuera de alcance

- Theming por organización (accent/density editables) — YAGNI, sin pedido
  de producto.
- Cualquier cambio de comportamiento/lógica de negocio fuera de la
  apertura de los dos modales del §4.4 — esto es un retrofit visual, no
  una revisión funcional.
- Tests automatizados.
- Rediseño de pantallas no incluidas en el mock (no hay ninguna fuera de
  las 8 + Admin).

## 6. Verificación

- `cd web && npm run build` limpio tras cada tanda de cambios.
- Pasada visual del usuario en el navegador contra el mock (mismo
  criterio que las Etapas anteriores) antes de dar la etapa por cerrada.
- Sin verificación de servidor: este trabajo es 100% `web/`, no toca
  `server/`.
