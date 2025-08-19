# Notas de versión

## 1.0.7
Fecha de publicación: 2025-08-19
- Modo Imagen: nuevo módulo tipo “proyección” minimal. Visor 400×400 adaptable que soporta Imágenes/PDF/Audio; mantiene el último contenido en pantalla. Lee un archivo de control `.txt` configurable (carpeta/nombre), elimina tras procesar y notifica por IPC. Nueva vista `public/imagen.html`, lógica en `src/imagen.ts`. IPC: `image:test-control`, evento `image:new-content`. Apertura externa desde el sistema.
- Navegación: `open-view` ahora acepta `'imagen'` para cargar `imagen.html` y ajustar tamaño de ventana.
- FTP Server integrado: servicio basado en `ftp-srv` con inicio/detención desde Administración. Configurable `FTP_SRV_HOST`, `FTP_SRV_PORT`, `FTP_SRV_USER`, `FTP_SRV_PASS`, `FTP_SRV_ROOT`, `FTP_SRV_ENABLED` (autoarranque). Estado visible con URL y raíz. Botones “Copiar URL” (usa `127.0.0.1` si host=`0.0.0.0`) y “Abrir carpeta” (normaliza la ruta y crea la carpeta si no existe). Corrección de persistencia de campos `FTP_SRV_*` y valor por defecto de raíz `C:\\tmp\\ftp_share`.
- Auto-Update: limpieza automática del directorio `pending` antes de descargar para evitar errores EPERM al renombrar; barra de progreso de descarga; Releases públicos como feed de actualización.
- UI/UX: mejoras en `public/auth.html` (tamaños de botón/título, sin scroll). Textos de ayuda en Configuración → FTP Server. Estado de servidor compacto “ON • ftp://usuario:••••@host:puerto → raíz”.
- Documentación: agregado `docs/MODO_IMAGEN.md`. Actualizadas `docs/doc_modo_admin/CONFIG_AUTOMATIZACION.md` (intervalo remoto) y `docs/doc_modo_admin/CONFIG_FTP.md` (sección “FTP Server integrado”).

## 1.0.6
Fecha de publicación: 2025-08-17
- *Automatización: modo remoto autónomo, envío FTP de mp.dbf*.
- Manual autónomo en `build/manual.html`: integración completa de contenido (Admin/Caja) con paneles de detalle, búsqueda en navegación y en contenido con resaltado, controles de Expandir/Colapsar todo, botón Imprimir/PDF, secciones nuevas (Guía rápida, Glosario, FAQ), callouts y botón flotante “Arriba”. Notas de versión internas.
- Bandeja del sistema (Windows): al minimizar/cerrar se oculta a la bandeja; icono junto al reloj con menú contextual (Mostrar, Ir a Caja, Ir a Configuración, Salir). Se corrigió navegación desde la bandeja para que “Ir a Caja/Configuración” muestre la ventana y cargue la vista.
- Icono de bandeja: prioridad a `build/icon.ico` (si existe), luego `public/icon.png`/`icon.ico`, y fallback al ejecutable. Ajuste de tamaño a 16×16 en Windows para visibilidad. Script opcional para generar iconos (`scripts/generate-icons.js`) y comando `npm run icons:gen`.
- Persistencia de posición (Modo Caja): guarda coordenadas al mover/minimizar/cerrar y restaura al abrir o al seleccionar “Ir a Caja” desde la bandeja, adaptando a la resolución actual y evitando fuera de pantalla.

## 1.0.5
- Vista previa en Configuración: filtro, copiar, descargar/restaurar JSON, expandir/ocultar.
- Configuración: mejoras UI/UX en Mercado Pago, FTP, Seguridad, Email/SMTP y Notificaciones de Error.
- Documentación: secciones de Caja y Configuración.
