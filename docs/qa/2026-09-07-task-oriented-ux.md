# Oliver — menos pasos y menos ruido

Segunda iteración del 7/9/2026. Mantiene el sistema visual de
`2026-09-07-ui-consistency.md`; no cambia backend ni datos.

## Cambios

1. **Filtros progresivos.** Empleados, Asistencia, Horas y Ausencias agrupan
   filtros secundarios en “Más filtros”. Los principales siguen visibles.
   La selección se aplica inmediatamente y no se borra al plegar. El resumen
   muestra cuántos secundarios están activos; “Limpiar filtros” los restablece.
2. **Listas móviles.** Empleados, Sucursales, Legajos, registros de Asistencia
   y registros de Ausencias muestran resumen + acceso al detalle por debajo
   de 768 px. Misma consulta y paginación, sin peticiones extra. Las acciones
   de empleados/sucursales se reutilizan desde un único renderizador y están
   disponibles bajo “Acciones”, con las mismas restricciones de permisos.
   Las tablas comparativas de horarios, horas y liquidación se conservan:
   una tarjeta no es mejor para todos los tipos de datos.
3. **Vacíos accionables.** Crear el primer empleado/sucursal, limpiar una
   búsqueda, ir a empleados desde Legajos, ampliar fechas en Asistencia o
   cargar una ausencia. Se distinguen estados iniciales, filtros y errores.
   Las listas de empleados, sucursales y ausencias ahora muestran explícitamente
   los errores de consulta y permiten reintentar.
4. **Prioridades en Inicio.** “Tu próximo paso” aparece antes de las métricas.
   Solicitudes, certificados, marcas rechazadas y turnos sin salida enlazan a
   sus módulos; las cantidades no se suman porque pueden solaparse.
   No se afirma que esté todo resuelto si falta completar una consulta o falla.
   Se eliminan tarjetas vacías de ausencias/salidas/movimientos del dashboard.
5. **Ayuda contextual.** Orden de solicitudes, recepción de certificados y
   explicación de cierres pasan a disclosures de texto. Los requisitos que
   bloquean un cierre y las advertencias de confirmación permanecen visibles.

## Validación

`npm run build`, `npm run lint`, `npm run test:ui:all`.

El QA mantiene 22 rutas × 390/768/1440 px, pestañas secundarias y flujos de
operación. Agrega: prioridades con solicitud pendiente; apertura de filtros
con teclado; parámetro enviado al API; persistencia al plegar; limpieza;
navegación y edición desde tarjeta móvil; creación desde vacío; error de lista
sin falso vacío; error de prioridades sin mensaje de “sin pendientes”.

Auth/API son fixtures locales. Sin escrituras en Supabase. Las capturas se
producen en el directorio temporal informado por el script. No reemplaza QA
con roles/datos reales, Safari/iOS físicos, geolocalización ni despliegue público.
