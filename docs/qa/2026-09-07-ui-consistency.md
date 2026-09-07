# UI Oliver — revisión de coherencia (7 de septiembre de 2026)

## Criterio visual

Modernizar la consistencia, no reemplazar la identidad ni agregar decoración.
Se mantienen Archivo, el blanco frío `#fcfcfd`, el oliva `#5c7a1a` y la
profundidad sutil de los controles. Sin dependencias nuevas de UI.

- Espaciado sobre pasos de 4/8 px; margen de página 16 móvil, 24 tablet, 32 escritorio.
- Secciones separadas por 32 px; tarjetas 16 móvil / 24 escritorio.
- Texto de producto 14 px; ayuda y metadatos 12–13 px; títulos 16–20 px.
- Eliminar tamaños fraccionarios y etiquetas de 10/11 px. Mono reservado principalmente a datos.
- Campos 40 px, filtros compactos 36 px. Inputs/selects editables en móvil: mínimo 44 px y texto 16 px (sin zoom de foco iOS).
- Tablas con cabeceras 12 px y celdas 13 px, padding 12 × 16 px. Scroll horizontal **dentro** de la tabla; no partir CUIL, fechas u horarios.
- Métricas en dos columnas móvil/tablet, última celda impar a ancho completo; columnas originales desde 1024 px.
- Un único h1 en Topbar, acciones en fila independiente cuando no hay espacio.
- Tabs y segmentos desplazables, navegación con flechas. Acciones por fila visibles sin hover en pantallas táctiles.
- Modales nativos con `showModal`, scroll limitado al viewport, foco circular y restauración al disparador. Toasts dentro del modal activo para no quedar debajo del top layer.

Referencias de criterio (no plantillas copiadas):
- [Atlassian — espaciado](https://atlassian.design/foundations/spacing)
- [Atlassian — tipografía](https://atlassian.design/foundations/typography/applying-typography)
- [MDN — dialog y accesibilidad](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/dialog)

## Validación reproducible

```sh
npm run build
npm run lint
npm run test:ui
npm run test:ui:all
```

`test:ui:all` usa un build de producción temporal, auth y API interceptadas.
**No se conecta a Supabase ni modifica datos reales.** Las capturas se guardan
en el directorio temporal informado al terminar.

Cobertura base: 22 rutas a 390, 768 y 1440 px (66 combinaciones):
Inicio; empleados/lista y detalle; sucursales/lista y detalle; asistencia;
horas; turnos; ausencias; liquidación; legajos/lista y detalle; configuración;
plan; administración/lista y organización; portal; chat; marcar; login;
bienvenida; 404.

Además recorre las pestañas secundarias a 390 y 1440 px; comprueba aprobación,
cierre de liquidación, consulta agregada de horarios, foco y cierre con Escape
del formulario largo de empleado y apertura del panel lateral de asistencia.
Se verifican errores JavaScript y desbordes de página/main; las tablas pueden
seguir desplazándose horizontalmente. Las capturas desactivan animaciones.

La inspección visual es necesaria además de las medidas: se encontraron
solapamientos entre filtros que no aumentaban el scrollWidth de la página.

## Límites

- Fixtures pequeñas: listas con datos representativos y estados vacíos; no constituye
  una validación de todas las combinaciones de datos, roles y permisos reales.
- No valida entrega de OTP, geolocalización, mapas externos, QR real, archivos
  de producción ni autenticación contra Supabase.
- Chromium; no sustituye una pasada en Safari/iOS y Android físicos.
- Lint conserva las 7 advertencias existentes de Fast Refresh; sin errores.
- Sin cambios de backend, migraciones o modelo de datos.
