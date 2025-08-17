# Notas de versión

## 1.0.6
Fecha de publicación: 2025-08-17
- Manual autónomo en `build/manual.html`: integración completa de contenido (Admin/Caja) con paneles de detalle, búsqueda en navegación y en contenido con resaltado, controles de Expandir/Colapsar todo, botón Imprimir/PDF, secciones nuevas (Guía rápida, Glosario, FAQ), callouts y botón flotante “Arriba”. Notas de versión internas.
- Bandeja del sistema (Windows): al minimizar/cerrar se oculta a la bandeja; icono junto al reloj con menú contextual (Mostrar, Ir a Caja, Ir a Configuración, Salir). Se corrigió navegación desde la bandeja para que “Ir a Caja/Configuración” muestre la ventana y cargue la vista.
- Icono de bandeja: prioridad a `build/icon.ico` (si existe), luego `public/icon.png`/`icon.ico`, y fallback al ejecutable. Ajuste de tamaño a 16×16 en Windows para visibilidad. Script opcional para generar iconos (`scripts/generate-icons.js`) y comando `npm run icons:gen`.
- Persistencia de posición (Modo Caja): guarda coordenadas al mover/minimizar/cerrar y restaura al abrir o al seleccionar “Ir a Caja” desde la bandeja, adaptando a la resolución actual y evitando fuera de pantalla.

## 1.0.5
- Vista previa en Configuración: filtro, copiar, descargar/restaurar JSON, expandir/ocultar.
- Automatización: modo remoto autónomo, envío FTP de mp.dbf.
- Configuración: mejoras UI/UX en Mercado Pago, FTP, Seguridad, Email/SMTP y Notificaciones de Error.
- Documentación: secciones de Caja y Configuración.
