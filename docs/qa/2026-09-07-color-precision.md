# Precisión cromática — 2026-09-07

## Alcance
Frontend únicamente; sin backend, datos ni migraciones. Mantiene Archivo,
blanco frío `#fcfcfd` y oliva `#5c7a1a`. No introduce dependencias.

## Roles del sistema
- Marco/sidebar/topbar: blanco frío. Canvas del panel: `#f7f8fa`.
  Tarjetas blancas con sombra mínima; controles conservan profundidad sutil.
- Acción principal: oliva sólido. Navegación/página activa: oliva tenue,
  texto oscuro e indicador lateral en sidebar. Módulo activo también en detalle.
- Texto secundario/metadata: grises legibles, no opacidad decorativa aplicada
  a información. El texto oliva en Status y diferencias de liquidación usa700
  para mantener contraste sobre filas grises.
- Bordes decorativos suaves; contorno de inputs/selects compartidos separado
  en `border-control`. No oscurecer todos los separadores para imitar inputs.
- Advertencias ámbar oscuro sobre tinte claro; errores rojo oscuro sobre rosa.
  Borrar registros, ausencias, horarios y plantillas usa variante destructiva.
  Hover/active destructivos sólidos (no opacidad que reduzca contraste).
- Login: subtítulo y pie blancos sobre oliva, sin transparencia insuficiente.

## Contraste nominal (sRGB)
`npm run test:colors` lee tokens reales y verifica40pares sin redondear al
comparar umbrales. Texto normal≥4.5:1, límites de controles/foco≥3:1.

| Par | Ratio |
| --- | --- |
| Metadata / blanco frío | 5.35:1 (antes2.82:1) |
| Metadata / superficie gris | 4.82:1 |
| Blanco / CTA oliva | 4.94:1 |
| Activo oscuro / oliva tenue | 8.01:1 |
| Error / rosa | 5.30:1 |
| Advertencia / tinte ámbar | 6.84:1 |
| Borde control / superficie gris | 3.20:1 |

También cubre estados hover/active y composición de fondos warning con alfa.
Esta prueba no certifica WCAG completa: no cubre cada composición posible,
contenido dinámico ni todos los controles personalizados de la aplicación.

## Validación
- Build TypeScript/Vite y lint (7 advertencias Fast Refresh preexistentes).
- QA aislada Playwright:22rutas a390/768/1440px, pestañas, teclado/modales,
  filtros, estados vacíos y fallos, sin overflow del documento/main ni erroresJS.
- Aserciones de estilos computados: navegación suave, módulo activo en detalle,
  canvas y CTA primario sólido en empleados.
- Inspección visual de capturas: empleados desktop, Inicio y Ausencias móvil,
  login desktop. Contornos visibles sin convertir las tarjetas en cajas pesadas.
- API/auth son fixtures locales. No se verifica aquí el despliegue público.
