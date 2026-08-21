# Export a Excel (Asistencia, Horas, RRHH)

Fecha: 2026-08-21
Estado: aprobado, pendiente de plan de implementación

## 1. Contexto

Segundo subproyecto de una comparación contra el remote git `externo` (repo
Next.js pre-migración) hecha en una sesión anterior, que identificó 3 gaps
entre ese repo y el actual: Export a Excel, RRHH (ausencias) y WhatsApp
Cloud API + agente IA. Se decidió con el usuario el orden: RRHH primero,
export después, WhatsApp queda fuera de alcance por ahora.

Este plan cubre exportar a `.xlsx` los tres reportes que ya existen en el
panel: **Asistencia**, **Horas** y **RRHH (ausencias)**. No agrega ninguna
lógica de negocio nueva — envuelve datos que ya devuelven funciones
existentes: `listAsistencia`/`listRechazadas`/`calcularHoras` (las tres en
`server/src/lib/asistencia.ts` — no hay un `horas.ts` separado, Horas se
calcula ahí mismo a partir de la asistencia) y `listAusencias` (en
`server/src/lib/rrhh.ts`).

RRHH ya está mergeado a `main` (commit `5537b67`) — el server ya tiene
`listAusencias` y la ruta `/api/ausencias` disponibles, así que este plan
puede ejecutarse directamente sobre `main` sin esperar nada más.

## 2. Decisiones tomadas con el usuario

- **Generación del lado del servidor**, con la librería `exceljs` (ya
  decidido en una sesión anterior — hay que reinstalarla en
  `server/package.json`, se sacó de la raíz del monorepo en la migración a
  Vite/Etapa 5).
- **Disparador**: un botón "Descargar Excel" en la barra de filtros de cada
  una de las 3 páginas existentes (Asistencia, Horas, RRHH), no una página
  de "Exportes" centralizada nueva. El archivo exportado respeta los
  filtros activos en pantalla en ese momento (rango de fechas, y en
  Asistencia/RRHH también sucursal/motivo si están filtrados).
- **Multi-hoja**: Asistencia y Horas tienen 2 tablas cada una en su página
  hoy — el export de cada una genera un solo `.xlsx` con 2 hojas (una por
  tabla), no dos archivos separados ni una sola tabla recortada.
- **RRHH incluye columnas que hoy no se muestran en pantalla**
  (`detalle`, `contacto`) — a diferencia de la tabla en pantalla (que es
  angosta y no las muestra), un export es exactamente el lugar donde esos
  datos sí son útiles.
- **Sin filas → archivo igual, hoja vacía** (headers nomás), no es un
  error.

## 3. Arquitectura

- **`server/src/lib/excel.ts`** (nuevo): helper mínimo compartido por las 3
  rutas — arma un `ExcelJS.Workbook`, agrega hojas a partir de
  `{ nombre: string; columnas: { header: string; key: string; width?: number }[]; filas: Record<string, unknown>[] }[]`,
  y una función que lo serializa a `Buffer` y lo manda por `reply` con los
  headers correctos (`Content-Type:
  application/vnd.openxmlformats-officedocument.spreadsheetml.sheet`,
  `Content-Disposition: attachment; filename="..."`). Sin lógica de
  negocio — solo el envoltorio de exceljs + Fastify.
- **3 rutas nuevas**, cada una detrás de `[requireAuth, requireOrg]` como el
  resto de la API, mismos query params que ya usa la página equivalente:
  - `GET /api/asistencia/export?desde=&hasta=` (`server/src/routes/asistencia.ts`)
  - `GET /api/horas/export?desde=&hasta=` (`server/src/routes/horas.ts`)
  - `GET /api/ausencias/export?desde=&hasta=&sucursalId=&motivo=` (`server/src/routes/rrhh.ts`)
- **Frontend**: helper de descarga autenticada nuevo (mismo patrón que
  `web/src/pages/sucursales/useQrBlob.ts` — un `<a href>` plano no puede
  mandar el header `Authorization`, así que se pide el archivo por `fetch`
  con el Bearer token, se arma un blob URL, y se dispara la descarga desde
  ahí). Un botón "Descargar Excel" nuevo en cada una de las 3 páginas,
  deshabilitado mientras se genera, con nombre de archivo
  `<reporte>_<desde>_<hasta>.xlsx`.

## 4. Contenido de cada archivo

**Asistencia** (`GET /api/asistencia/export`):
- Hoja "Registros" (de `listAsistencia`): Fecha y hora, Empleado, Sucursal, Tipo.
- Hoja "Rechazadas" (de `listRechazadas` — sin filtro de fecha, igual que la
  tabla en pantalla, siempre son las no resueltas): Fecha, Empleado,
  Sucursal, Tipo, Motivo, Distancia (m), Resuelto.

**Horas** (`GET /api/horas/export`):
- Hoja "Resumen" (de `calcularHoras().resumen`): Empleado, Total horas, Estado.
- Hoja "Turnos" (de `calcularHoras().turnos`): Empleado, Sucursal, Entrada, Salida, Horas.

**RRHH** (`GET /api/ausencias/export`):
- Hoja "Ausencias" (de `listAusencias`): Empleado, Sucursal, Fecha desde,
  Fecha hasta, Motivo, Certificado pendiente, Detalle, Contacto.

## 5. Fuera de alcance

- Cualquier formato/estilo visual del Excel más allá de headers en negrita
  y ancho de columna razonable (sin colores condicionales, sin gráficos).
- Programar envíos automáticos/periódicos del export (por mail, por
  ejemplo) — esto es descarga manual bajo demanda únicamente.
- Exportar RRHH antes de que esa rama esté mergeada a `main` (ver §1).
