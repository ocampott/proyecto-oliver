# Rediseño "moderno y cómodo" de web/ — reemplazo del look Modernist plano

Fecha: 2026-08-19
Estado: aprobado (fuente de verdad: canvas de Claude Design publicado en
`https://claude.ai/code/artifact/693d9ac0-9696-4fa5-97d9-b5938ccd1a77`,
página "Rediseño completo — Reimaginado (D)")

## 1. Contexto

Más temprano en esta misma sesión se cerró un retrofit "pixel-perfect
Modernist" (esquinas rectas, sin sombras, divisores gruesos de 2px, `Badge`
en mayúscula con fondo sólido, contenedor de 1440px). El usuario lo vio
funcionando y pidió explícitamente un rediseño: "siguiendo la misma línea
de lo que tenemos hoy... pero más moderno y atractivo". Tras explorar tres
direcciones de bajo alcance (A/B/C, solo Home) el usuario pidió ver las 6
pantallas completas y una opción que fuera "realmente distinta" — no una
variación de superficie. Esa cuarta dirección (D) es la que quedó
aprobada, con dos rondas de ajuste (navbar superior en vez de lateral,
popover de cuenta en vez de nombre completo, tablas sin acentos
inconsistentes) hasta llegar al estado final publicado en el canvas.

**Este spec reemplaza los tokens visuales del retrofit Modernist de hoy**
(radios, sombras, densidad, paleta neutra, tratamiento de estados en
tabla). No reemplaza su arquitectura de componentes (`Button`/`Card`/
`Field`/`Select`/`Dialog`/`Table` siguen existiendo como archivos, cambian
sus valores internos) ni el trabajo de layout de la etapa anterior
(`PanelLayout` sigue proveyendo el `<main>` compartido de 1440px — eso NO
cambia en este spec).

**Tipografía:** el usuario decidió explícitamente mantener Archivo — no
hay migración de fuente en este spec, a pesar de que el canvas exploró
tres alternativas (Space Grotesk, Bricolage Grotesque, Sora) en la
pantalla "D — Opciones de tipografía". Esas quedan descartadas.

## 2. Decisiones tomadas con el usuario

- **Navbar arriba, no lateral.** Se probó un nav lateral fijo (sidebar) y
  el usuario pidió volver a una barra superior, pero "más moderna" que la
  simple barra con pastilla activa de la dirección C: sticky, fondo blanco
  al 90% de opacidad con `backdrop-filter: blur(8px)`, sombra inferior de
  1px en vez de borde sólido.
- **Wordmark "oliver" en minúscula, sin marca/ícono.** El cuadradito de
  acento (`10-11px`, `background: var(--color-accent)`) que acompañaba el
  wordmark en las primeras iteraciones se sacó a pedido explícito del
  usuario ("quitame el chip del oliver") — el wordmark es solo texto.
- **Links de navegación agrupados a la derecha**, no pegados al wordmark.
  `margin-left: auto` empuja el grupo de links (+ el avatar) contra el
  borde derecho de la barra; el wordmark queda solo a la izquierda.
- **Cuenta como avatar con iniciales + popover, no nombre completo.** El
  nav ya no muestra el nombre de la organización como texto plano — solo
  un botón circular (32px, fondo acento, iniciales en blanco) al final del
  grupo de links. Al clickearlo abre un popover (no un modal: sin
  backdrop oscurecido) con el nombre completo de la organización, el
  email del usuario logueado, y dos acciones: "Configuración" y "Cerrar
  sesión".
- **Paleta más neutra y clara, con cards blancas.** El fondo de página
  pasa de `#f3f2f2` (gris cálido) a `#f7f7f8` (gris neutro más claro); las
  cards/tablas pasan de `background: var(--color-surface)` gris
  (`#eae9e9`) a **blanco puro** con un borde `1px solid #e7e7ea` — el
  contraste ahora lo da el borde + una sombra sutil, no un fondo gris.
- **Radios y sombras suaves en vez de esquinas rectas planas.** Esto es lo
  que más se aleja del retrofit de hoy: cards/tablas/diálogos con radio
  12-18px y sombra sutil (`0 1px 2px rgba(24,24,27,.06), 0 8-14px
  24-32px rgba(24,24,27,.06-.08)`); botones/inputs con radio 9-10px;
  pastillas/avatar con radio completo (999px).
- **Densidad de tabla más cómoda**, no más compacta: filas de ~56px
  (`padding: 15px 18px` vs. el `p-2` actual), encabezados en gris
  `#9a9aa2` en vez de `text-text/60`.
- **Estados de tabla como punto de color + etiqueta, no `Badge`
  sólido/mayúscula.** "Activo"/"Activa"/"Vinculado"/"Sin vincular" pasan
  de un tag con fondo sólido en mayúscula a un punto de 6-7px + texto
  normal (`Activo`, no `ACTIVO`). El componente `Badge` actual (fondo
  sólido invertido, uppercase, tracking ancho) queda **retirado de las
  tablas** — ver §4.4 qué le pasa al componente.
- **Acciones de fila como íconos, no texto repetido.** "Editar",
  "Desactivar", "Ver QR", "Generar código" dejan de ser botones de texto
  en cada fila — pasan a ser botones cuadrados de 30×30 con un solo ícono,
  agrupados a la derecha de la fila (`justify-content: flex-end`).
- **Sin acentos de color inconsistentes en la tabla.** Una iteración
  intermedia le puso borde/fondo azul a algunos botones de ícono (QR,
  generar código) y resaltó una fila con un fondo celeste tenue para
  "mostrar" que ahí se abría un modal — el usuario lo marcó como algo que
  "se ve raro". **Decisión: todos los botones de ícono en una fila usan el
  mismo tratamiento neutro** (`border: 1px solid #e7e7ea; background:
  #ffffff; stroke: #55555d`), sin excepción — el acento de marca
  (`#1d4ed8`) no se usa para decorar botones de acción secundarios dentro
  de una tabla.
- **Marcar (pantalla pública del empleado) también se rediseña**, con el
  mismo lenguaje visual (card centrada, radio 20px, sombra), pero se
  mantiene 100% el comportamiento ya implementado hoy — incluye el fix ya
  aplicado esta sesión de que la pantalla de rechazo usa un título neutro
  ("No pudimos registrar la marca") en vez de asumir siempre "fuera de
  rango".
- **Admin mantiene su propio header** (breadcrumb "oliver / Administración"
  + pill "Platform admin"), sin la barra de navegación de organización ni
  el popover de cuenta — sigue siendo una pantalla de superadmin aparte,
  no dentro del panel de una org (esto no cambia respecto a hoy: `AdminPage`
  no está envuelta en `PanelLayout`).
- **"Configuración" en el popover queda sin destino.** No existe ninguna
  pantalla de configuración hoy ni se pidió una — el ítem se muestra pero
  no navega a ningún lado todavía (decisión tomada acá, no por el
  usuario: es la lectura más simple de "dame el popover" sin inventar una
  pantalla nueva no pedida). "Cerrar sesión" si se implementa funcional
  (ver §4.7) porque es comportamiento obvio y ya soportado por Supabase
  Auth.

## 3. Paleta y tokens (`web/src/index.css`)

Reemplaza el bloque `@theme` actual. Los tokens de acento (`--color-accent-*`,
generados con `color-mix` en oklch) **no cambian** — siguen produciendo
tintes válidos para el nuevo diseño (el `#eaf0fe` usado en el mock es
prácticamente el mismo tono que ya produce `--color-accent-100`).

```css
@theme {
  --color-bg: #f7f7f8;
  --color-surface: #ffffff;
  --color-text: #18181b;
  --color-text-secondary: #55555d;
  --color-text-tertiary: #9a9aa2;
  --color-text-muted: #c4c4ca;
  --color-accent: #1d4ed8;
  --color-accent-100: color-mix(in oklch, var(--color-accent) 12%, white);
  --color-accent-200: color-mix(in oklch, var(--color-accent) 24%, white);
  --color-accent-300: color-mix(in oklch, var(--color-accent) 40%, white);
  --color-accent-400: color-mix(in oklch, var(--color-accent) 65%, white);
  --color-accent-500: var(--color-accent);
  --color-accent-600: color-mix(in oklch, var(--color-accent) 85%, black);
  --color-accent-700: color-mix(in oklch, var(--color-accent) 68%, black);
  --color-accent-800: color-mix(in oklch, var(--color-accent) 52%, black);
  --color-accent-900: color-mix(in oklch, var(--color-accent) 38%, black);
  --color-border: #e7e7ea;
  --color-border-soft: #f0f0f2;
  --color-success: #22c55e;
  --color-success-700: #15803d;
  --color-warning: #f59e0b;
  --color-alert: #c2410c;
  --color-alert-100: #fdf1e8;
  --font-sans: "Archivo", sans-serif;
}

body {
  background-color: var(--color-bg);
  color: var(--color-text);
  font-family: var(--font-sans);
}
```

**Se eliminan** `--color-divider` (el borde grueso de 40% opacidad del
retrofit anterior — reemplazado por `--color-border`/`--color-border-soft`,
hairlines de verdad) y cualquier uso de `border-divider`/`border-b-2` en
componentes tocados por este spec. Grep de `border-divider` tras el cambio
debería devolver cero resultados en los archivos listados en §4-§5 (puede
seguir existiendo en `Login`/`Marcar` si ese archivo no está en la lista de
tareas de un componente — ver alcance por archivo en el plan).

## 4. Componentes compartidos (`web/src/components/ui/*`)

### 4.1 `button.tsx`

- Radio 9-10px (`rounded-[9px]`) en vez de esquinas rectas.
- Peso de fuente: `font-semibold` (600) en vez de `font-extrabold` (800) —
  el mock usa botones menos "gritones" que el retrofit anterior.
- `primary`: `bg-accent text-white`, sin cambios de estructura.
- `secondary`: `bg-white border border-[--color-border] text-text`.
- `ghost`: se mantiene para casos de texto-solo fuera de tablas (ninguna
  pantalla de este spec lo usa dentro de una tabla — las acciones de fila
  pasan a `icon`, ver abajo).
- **Nuevo tratamiento `icon` para acciones de tabla**: en vez de variar
  `size="icon"` sobre `Button`, se agrega un componente pequeño
  `IconButton` (mismo archivo o `icon-button.tsx`) — 30×30, `rounded-lg`
  (8px), `border border-[--color-border] bg-white`, ícono `14px` en
  `--color-text-secondary`. Sin variantes de color: todas las acciones de
  fila usan el mismo tratamiento neutro (§2, "sin acentos inconsistentes").

### 4.2 `card.tsx`

- `background: white`, `border: 1px solid var(--color-border)`,
  `border-radius: 14px`, sombra sutil:
  `box-shadow: 0 1px 2px rgba(24,24,27,.06), 0 10px 24px rgba(24,24,27,.06)`.
  Padding se mantiene en `22-26px` (el mock usa 22-26px indistintamente,
  tomar 24px como valor único).

### 4.3 `field.tsx` / `select.tsx` / `input.tsx`

- Radio 9px, `border: 1px solid var(--color-border)`, `background: white`
  (los filtros de búsqueda en el mock usan fondo blanco, no gris — ajustar
  desde el `bg-bg` actual de `input.tsx`).
- El ícono de lupa dentro del input de búsqueda (Sucursales/Empleados) es
  nuevo: `Field` no lo soporta hoy. Agregar un wrapper opcional o un
  `SearchField` que reutilice `Field` con un `<svg>` posicionado
  absoluto a la izquierda y `padding-left` extra en el input — ver mock
  para el ícono exacto (lupa, `stroke: #9a9aa2`, 15px, `left: 12px`).

### 4.4 `badge.tsx` → uso reducido + nuevo `status.tsx`

- `Badge` **se mantiene** como componente (no se borra) pero su uso se
  reduce al contador de tipo pastilla ("N pendientes" en Asistencia):
  radio completo (999px), `background: var(--color-alert-100)`,
  `color: var(--color-alert)`, sin mayúscula/tracking ancho.
- **Nuevo componente `web/src/components/ui/status.tsx`** para
  reemplazar el uso de `Badge` en columnas de estado de tabla: un punto
  de color (6-7px, `border-radius: 50%`) + texto (`13px`, peso normal).
  Variantes por tono: `success` (`#22c55e`/texto normal), `warning`
  (`#f59e0b`), `neutral`/inactivo (`#d4d4d9`, texto en
  `--color-text-muted`), `accent` (`--color-accent`, para "Turno en
  curso"/"En curso" en Horas). Firma sugerida:
  `<Status tone="success">Activo</Status>`.
- El código OTP en Empleados (columna Dispositivo, estado "código
  pendiente") deja de usar `Badge variant="outline"` — pasa a un punto
  ámbar + texto monoespaciado del código + texto atenuado con los
  minutos, sin pastilla envolvente (ver mock, fila con OTP activo).

### 4.5 `dialog.tsx`

- Panel: `border-radius: 18px`, `padding: 26-30px`, sombra marcada
  (`box-shadow: 0 24px 60px rgba(24,24,27,.22), 0 4px 14px rgba(24,24,27,.08)`).
  Backdrop: `background: rgba(24,24,27,.42)` + `backdrop-filter: blur(2px)`
  (antes `bg-[#201e1d]/50` sin blur).
- El botón "Cerrar" en el header deja de ser texto (`Button variant="ghost"`)
  — pasa a un botón circular/cuadrado pequeño (30×30, `background:
  #f2f2f4`, sin borde) con un ícono de X. Mantiene el mismo comportamiento
  (cierra el diálogo).
- El QR dialog (Sucursales) agrega un eyebrow ("Código QR", 11.5px
  uppercase gris) arriba del título — el título deja de incluir el prefijo
  "QR — " (ya lo dice el eyebrow) y pasa a ser solo el nombre de la
  sucursal.
- El botón "Descargar PNG" pasa a `rounded-[10px]`, mantiene
  `variant="primary" block` y el ícono ya presente.
- El código de vinculación (Empleados) suma un ícono de "llave"/candado en
  un cuadrado `accent-100` arriba del texto "Código de vinculación", y un
  botón "Cerrar" de texto (`variant="secondary"`, ancho completo) abajo —
  el mock lo muestra como cierre explícito además del ícono de X del
  header (redundante pero intencional, coincide con el patrón de otros
  modales de confirmación).

### 4.6 `table.tsx`

- Contenedor: se envuelve en un `div` con `border: 1px solid
  var(--color-border)`, `border-radius: 14px`, `overflow: hidden` — hoy
  la tabla no tiene contenedor propio, se agrega en cada página o se
  sube al primitivo `Table` mismo (decisión de implementación: subirlo al
  primitivo es más DRY, evaluar en el plan si conviene envolver `Table`
  en un `<TableContainer>` nuevo).
- `TableHead`: `padding: 13px 18px`, `font-size: 11.5px`, `color:
  var(--color-text-tertiary)`, sin `border-b-2` grueso — el header ya no
  lleva borde propio distinto al resto (el borde inferior del header pasa
  a `1px solid var(--color-border)`, igual grosor que las filas).
- `TableCell`: `padding: 15px 18px` (vs. `p-2` actual), borde inferior
  `1px solid var(--color-border-soft)` (más claro que el borde del
  contenedor).
- Última columna ("Acciones") queda alineada a la derecha
  (`text-align: right` en el header, `justify-content: flex-end` en las
  celdas) — hoy no tiene alineación especial.

### 4.7 Nuevo `web/src/components/AccountMenu.tsx` (popover de cuenta)

Componente hecho a mano (sin dependencia nueva — mismo criterio que
`Dialog`, que tampoco usa Radix): botón avatar + panel posicionado.

- **Props**: ninguna — lee `useAuth()` (`web/src/lib/auth.tsx`, ya
  expone `user: User | null` con `user.email`) y `useOrgActual()` (hoy
  vive en `web/src/pages/sucursales/hooks.ts` como
  `useQuery({ queryKey: ["org"], queryFn: getOrgActual })` — **mover a
  un lugar compartido**, p.ej. `web/src/lib/hooks.ts`, y reexportar desde
  `sucursales/hooks.ts` para no romper el import existente, o actualizar
  ambos call sites; lo decide el plan).
- **Iniciales**: derivadas de `org.name` — primera letra de la primera
  palabra + primera letra de la última palabra, en mayúscula.
  `"Cliente de prueba"` → `"CP"`. `"Panadería del Sur"` → `"PS"`. Si
  `org.name` tiene una sola palabra, usar las dos primeras letras.
- **Estado**: `open: boolean` local (`useState`). Click en el avatar
  togglea. Cierra con click afuera (listener de `mousedown` en
  `document` comparando `event.target` contra un `ref` del panel,
  mismo patrón que ya usa `Dialog` para Escape) y con `Escape`.
- **Contenido del panel**: nombre de la organización (`org.name`, 13.5px
  bold) + email (`user?.email`, 12px gris) + separador + botón
  "Configuración" (sin `onClick`, decisión §2 — puede llevar
  `disabled` o simplemente no hacer nada al click, a definir en el plan)
  + botón "Cerrar sesión" (`onClick`: `await supabase.auth.signOut()`
  seguido de `navigate("/login", { replace: true })` — mismo patrón que
  ya usa `LoginPage.tsx` para redirigir).
- Estilo: panel `width: 232px`, `border-radius: 14px`, `background:
  white`, `border: 1px solid var(--color-border-soft)`, sombra marcada
  (mismo valor que `Dialog`), posicionado `absolute` debajo del avatar
  (`top: calc(100% + 12px)`, `right: 0` relativo a un contenedor `nav`
  con `position: relative`).

## 5. `PanelNav.tsx` (reemplaza el nav de la etapa anterior)

```tsx
<nav className="sticky top-0 z-20 flex items-center bg-white/90 backdrop-blur-sm px-8 py-3.5 shadow-[0_1px_0_rgba(24,24,27,0.07)]">
  <span className="text-[17px] font-extrabold tracking-tight">oliver</span>
  <div className="ml-auto flex items-center gap-0.5">
    {LINKS.map(...)} {/* pastillas: activo bg-accent-100 text-accent-700 font-semibold, inactivo text-text-secondary font-medium, todas rounded-full px-4 py-2 */}
    <AccountMenu />  {/* ver §4.7, margin-left extra para separarlo de los links */}
  </div>
</nav>
```

`PanelLayout.tsx` **no cambia** — sigue proveyendo
`<main className="mx-auto w-full max-w-[1440px] px-8 py-8">` alrededor de
`children`; este spec no toca el contenedor de página, solo el contenido
visual del `<nav>`.

## 6. Pantallas — qué cambia en cada una

Todas usan los componentes de §4 (Field/Select/Status/Table/Card según
corresponda) — acá solo lo que no se desprende directo de "usar el
componente nuevo".

- **Home**: sin cambios estructurales sobre lo que ya haces hoy (grilla
  de 4 accesos) — solo hereda `Card` nuevo (blanco, radio 14px, sombra) y
  el nav nuevo.
- **Sucursales / Empleados**: filas de acción pasan a `IconButton` (§4.1),
  columnas de estado a `Status` (§4.4), buscador con ícono de lupa (§4.3).
  Sin cambios de lógica (mismo filtrado en memoria ya implementado hoy).
- **Asistencia**: la tabla de "Intentos rechazados" usa un borde superior
  ámbar sutil en el contenedor (`border: 1px solid #f3ddc9` en el mock)
  en vez del blanco/gris estándar — es la única tabla con un tono de
  contenedor distinto, intencional (alerta). El contador "N pendientes"
  usa el `Badge` retocado de §4.4. Entrada/Salida en la tabla principal
  pasan de `Badge` a ícono + texto de color (verde para entrada, gris
  para salida) sin pastilla.
- **Horas**: "Turno en curso"/"En curso" pasan de `Badge variant="outline"`
  a `Status tone="accent"` (punto azul + texto azul).
- **Admin**: mantiene su propio header (breadcrumb + pill "Platform
  admin", §2) — hereda `Card`/`Table`/`Field` nuevos pero no el
  `PanelNav`/`AccountMenu` (no está envuelta en `PanelLayout`, sin
  cambios respecto a hoy).
- **Marcar** (`MarcarPage.tsx`): la card centrada pasa a `border-radius:
  20px` con sombra (no borde de 2px), los botones "Marcar entrada"/
  "Marcar salida" a `rounded-[14px]` con más padding vertical (`height:
  52px`). El banner de éxito pasa de la barra oscura sólida
  (`bg-text text-bg`) a un banner verde suave (`background: #eafaf0;
  color: #15803d`) con el mismo ícono de check. La pantalla de rechazo
  mantiene el título neutro ya implementado hoy ("No pudimos registrar
  la marca") — sin cambio de comportamiento, solo el mismo tratamiento
  visual suave (ícono en círculo ámbar claro en vez de solo el ícono
  suelto). **Login no está en el alcance de este spec** — el mock no lo
  tocó; queda con el estilo del retrofit anterior salvo que el plan
  decida (fuera de este spec) unificarlo por consistencia de marca.

## 7. Fuera de alcance

- Migración de tipografía (el usuario eligió mantener Archivo).
- Pantalla de "Configuración" real — el ítem del popover quede sin
  destino funcional.
- Cualquier cambio a `Login` (no cubierto por el mock aprobado).
- Tests automatizados (convención ya establecida en todo el repo).
- Server/API: cero cambios — este spec es 100% visual + un popover que
  llama a `supabase.auth.signOut()`, ya soportado por el cliente actual.

## 8. Verificación

- `cd web && npm run build` limpio en cada tanda.
- Pasada visual del usuario en el navegador comparando cada pantalla
  contra el artboard correspondiente del canvas aprobado
  (`https://claude.ai/code/artifact/693d9ac0-9696-4fa5-97d9-b5938ccd1a77`,
  página "Rediseño completo — Reimaginado (D)").
- Probar el popover de cuenta: abre con click, cierra con click afuera y
  con Escape, "Cerrar sesión" efectivamente desloguea y redirige a
  `/login`.
