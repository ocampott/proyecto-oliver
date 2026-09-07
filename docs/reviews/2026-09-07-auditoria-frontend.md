# Revisión frontend — 2026-09-07

## Alcance
Pull de main por fast-forward: 3fef4e0 → 0a88906. Sin modificar carpetas no versionadas .atl, .claude, .vercel.
Revisión focalizada en carga inicial, consultas/caché y módulos incorporados. No auditoría exhaustiva, no cambios al backend ni Supabase. Sin commit/push.

## Cambios
- PanelLayout carga bajo demanda: las rutas públicas no necesitan el shell administrativo. Suspense interno mantiene el shell durante carga de páginas.
- Legajos: debounce de 300 ms, cancelación de solicitudes obsoletas y error con reintento; los errores no se muestran como lista vacía.
- Liquidación: cancelación de consultas, validación de rango antes de consultar/exportar, error explícito y bloqueo de exportación durante actualización. Redondeo por minutos totales evita resultados como 1h 60m.
- Invalidación de datos derivados tras modificar empleados, ausencias, horarios, tolerancia y marcas de asistencia. No se baja indiscriminadamente el tiempo de caché.
- Chat: no confunde error de conexión con dispositivo no vinculado; espera el historial antes de habilitar conversación y descarta resultados de carga tras desmontaje/cambio de organización. Permite volver a seleccionar el mismo archivo tras falla.

## Verificación ejecutada
- npm run build: OK antes y después.
- npm run lint: sin errores; mismos siete warnings preexistentes de Fast Refresh.
- git diff --check: OK.
- Chunk principal: 270,75 → 257,08 kB; gzip 85,07 → 81,58 kB.
Esto NO mide latencia de API, mejora porcentual de navegación ni peso total de todas las rutas.

## QA manual pendiente
1. Entrar directo a login, marcar, chat; navegar entre páginas del panel con red lenta.
2. Buscar en legajos desde página 2; escribir rápidamente, borrar filtro, cambiar tamaño y simular error de red.
3. Cambiar fechas de liquidación, invertirlas o borrar una; confirmar que no se exporta mientras actualiza.
4. Cargar liquidación, editar sueldo/horarios/ausencia o resolver una marca rechazada y volver: debe consultar datos actualizados.
5. Chat vinculado con historial lento; fallo de estado o historial debe ofrecer reintento, no pedir revinculación.
6. Subir certificado con fallo y elegir nuevamente el mismo archivo.
7. Verificar permisos mediante API con owner/admin/agent y aislamiento entre dos organizaciones. Ocultar enlaces no es autorización.

## Prioridades técnicas pendientes
- Turnos: useHorariosDeVarios en src/pages/turnos/hooks.ts y HorariosTab.tsx lanza una consulta por empleado. Incorporar endpoint bulk con filtros por organización y sucursal antes de optimizar este flujo.
- Medir p50/p95 de endpoints con volumen representativo, cantidad de consultas y payload; revisar índices/planes SQL con el backend. No afirmar lentitud de base de datos sin medición.
- Realtime del dashboard observa INSERT de asistencia y refresca solo su consulta del día. Revisar DELETE/UPDATE, reconexión y cambio de día, además de frescura entre pestañas.
- Incorporar regresiones automatizadas focalizadas en caché, identidad, fechas y autorización.

## Evaluación del producto (hipótesis basada en código)
La secuencia empleados/sucursales → turnos → asistencia/horas → ausencias → liquidación es coherente. Legajos complementa empleados; el chat baja fricción al cargar novedades.
Priorizar integración antes que expansión:
1. Bandeja de pendientes con acciones: marcas incompletas, certificados faltantes y solicitudes para revisar, evitando duplicar avisos existentes.
2. Estados de solicitud (pendiente/aprobada/rechazada) con responsable e historial, si el backend no los contempla aún.
3. Cierre de período con revisión de anomalías, foto de resultados y trazabilidad de cambios posteriores.
4. Portal del empleado desde el chat: consultar horarios, solicitudes, saldo y documentos, reutilizando la identidad existente.
5. Simplificar navegación agrupando legajos con empleados y liquidación/horas con operación, sin rediseño masivo.
Validar prioridades con clientes; no se implementaron estas propuestas.

Referencia técnica: https://tanstack.com/query/latest/docs/framework/react/guides/query-cancellation
