# Operación RRHH: implementación y revisión

## Estado
Implementado en frontend y API sobre main actualizado (frontend 0a88906, API e42cb3a).
Se entrega en rama de revisión `codex/operacion-rrhh` de ambos repos.
**No se aplicó la migración en Supabase remoto ni se desplegó producción.**
El informe de auditoría anterior describe la primera etapa; esta entrega implementa sus propuestas prioritarias.

## Qué probar
- **Ausencias → Pendientes**: bandeja de solicitudes y certificados (hasta 50 por categoría), acceso a legajos, marcas rechazadas y turnos abiertos. Campana con datos reales, no ejemplos.
- **Revisar**: aprobar/rechazar con comentario obligatorio e historial de usuario/fecha. Decisiones atómicas por revisión: una decisión sobre datos viejos devuelve conflicto, no sobrescribe.
- **Registros → abrir ausencia**: consultar historial. Editar fechas, motivo, detalle, empleado o sucursal vuelve a dejarla pendiente. Entregar certificado no reinicia la aprobación.
- **Liquidación → Cerrar período**: período terminado, toda la organización, sin solicitudes pendientes ni marcas abiertas. Confirmación de revisión, nota y snapshot inmutable con descarga JSON.
- **Ver copia e historial**: totales guardados no cambian. Se muestran cambios posteriores de fuentes (tabla, registro, operación y fecha); el indicador es conservador, incluye otros períodos.
- **Chat → Mis horarios, solicitudes y documentos**: portal del dispositivo vinculado. Saldo de referencia, solicitudes recientes y documentos compartidos explícitamente por RRHH.
- **Legajo → Visible para el empleado**: los archivos manuales nacen privados; los certificados enviados por el propio empleado sí se comparten. Acceso directo al legajo desde detalle de empleado.

## Reglas de negocio
- Ausencias preexistentes se mantienen aprobadas, incluso si llegaron desde chat. No se recalcula retroactivamente su estado.
- Nuevas solicitudes del empleado quedan pendientes; las altas de administración se consideran aprobadas.
- Solo aprobadas justifican ausencias y afectan saldo de vacaciones. Pendientes y rechazadas no se contabilizan en esos cálculos.
- El certificado sigue pendiente hasta que termina una subida exitosa, incluso si el empleado afirmó que ya lo tenía.
- Un cierre es una copia versionada, no un bloqueo contable. Se permiten correcciones posteriores y un nuevo cierre; no hay reapertura destructiva.
- No se modificaron fórmulas legales ni se convirtió la liquidación aproximada en recibo de sueldo.

## Optimización y correcciones
- Turnos y Horas reutilizan una consulta de horarios por organización. Overview y detalle del empleado comparten caché.
- El backend ya tenía GET /horarios sin empleadoId; se reutilizó en lugar de crear una API duplicada.
- Liquidación lee las fuentes una vez y reutiliza cálculo puro; evita consultas de asistencia/horarios repetidas y comprobaciones innecesarias de bajas.
- Se agregó el id faltante a horarios de cumplimiento: su ausencia podía generar ausencias inferidas aunque el empleado hubiera trabajado.
- Paginación interna de lecturas completas de horarios, empleados, asistencia para horas y ausencias para no truncar silenciosamente por el límite de PostgREST.
- Invalidation cruzada de cachés, búsqueda de legajos con debounce/cancelación, validación de fechas y errores explícitos.
- Realtime del dashboard contempla cambios, reconexión, regreso a pestaña y cambio de día; respaldo visible cada minuto y agrupación de eventos.
- GET /api/admin/metricas: solo superadmin. P50/P95 de las últimas 200 muestras por ruta, hasta 100 rutas, memoria de este proceso. No guarda IDs reales, cuerpos o tokens. No equivale a métricas históricas ni medición ya realizada de producción.

## Validaciones reproducibles
Frontend:
```sh
npm ci
npm run build
npm run lint
npx playwright install chromium
npm run test:ui
```
El smoke crea build de producción temporal con URLs ficticias y auth/API interceptadas. Verifica aprobación, cierre, consulta única de horarios, portal móvil sin overflow y ausencia de errores JS. No utiliza Supabase remoto. Capturas en carpeta temporal que informa el comando.

API:
```sh
npm ci
npm run build
npm run typecheck
npm test
```
Tests de cálculo, validación, rutas, permisos, paginación y SQL. La prueba SQL ejecuta migraciones 0001–0013 sobre PostgreSQL embebido temporal (PGlite), con auth/storage simulados y gen_random_uuid de core; no simula toda la infraestructura de Supabase.
Vitest solo incluye src/**/*.test.ts, evitando duplicar tests emitidos en dist/.

Resultados: build frontend/API y typecheck correctos; lint frontend sin errores y siete warnings preexistentes de Fast Refresh. Smoke en Chromium aprobado. Ver resumen de entrega para cantidad final de tests.
No se midió latencia real de la base remota ni se hizo QA con usuarios/productos reales.

## Activación coordinada
1. Revisar ambos diffs y preparar entorno de prueba con backup.
2. Aplicar 0013_operacion_rrhh.sql después de 0012 (repo API).
3. Desplegar API de esta rama.
4. Desplegar frontend de esta rama contra esa API.
5. QA real con owner/admin/agent, dos organizaciones y dispositivo vinculado antes de habilitar producción.
Coordinar ventana sin escrituras durante el cambio: la aprobación afecta qué solicitudes entran al cálculo. No publicar solo frontend contra la API vieja.

## Límites y pendientes operativos
- Pendientes: primeros 50 por categoría; cierres: últimos 50; eventos: últimos 100; portal: últimas 50 solicitudes/documentos. Límites visibles en UI.
- La bandeja enlaza correcciones de asistencia existentes; no inventa marcas faltantes ni las corrige automáticamente.
- Cambios posteriores a cierre identifican fuente/registro/fecha, no un historial completo de valores de todos los módulos. Decisiones de ausencias sí guardan usuario, comentario y antes/después.
- Métricas de servidor no incluyen tracing SQL ni persisten entre despliegues; validar índices/latencias con tráfico representativo.
- npm audit frontend: 0 vulnerabilidades. Backend: dos avisos moderados heredados en cadena uuid/exceljs; se corrigió qs sin cambios breaking. No se hizo downgrade forzado de ExcelJS.
