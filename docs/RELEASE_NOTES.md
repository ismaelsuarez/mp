# Notas de versión

## 1.0.9
Fecha de publicación: 2025-08-19
- Modo Imagen: manejo de múltiples ventanas según `VENTANA=`
  - `VENTANA=comun12`: refleja el contenido en dos ventanas (principal y secundaria), ambas persisten tamaño/posición y se reutilizan sin duplicados.
  - Ventana secundaria persistente (`imageDualWindow`): guarda/restaura bounds entre usos.
  - `VENTANA=nueva`: cada solicitud crea una ventana nueva; primera vez centrada en el mismo monitor de la ventana “comun”, siguientes veces restauran bounds guardados. Cierra con tecla ESC.
  - Enlaces web: si `URI` comienza con `http://` o `https://` y `VENTANA=nueva`, se abre en el navegador predeterminado del sistema.
  - UI: se oculta la barra de menú en todas las ventanas (principal y nuevas) para una presentación limpia.
  - Espejo (visual): la ventana secundaria de `comun12` se diferencia con un skin rosado (marco 4 px en todo el contorno y borde redondeado del visor), y agrega sufijo “(ESPEJO)” en el título cuando aplica.
  - Fallback visual: si la `URI` local/UNC no existe, se muestra `public/Noimage.jpg` (o `nombre_tc.png` como respaldo). Se registra en logs y el título indica “(no encontrado)”.

## 1.0.8
Fecha de publicación: 2025-08-19
- FTP: correcciones de control de tiempo y estabilidad
  - Respeto de `AUTO_REMOTE_MS_INTERVAL` o, en su defecto, del intervalo global; ejecución con mutex para evitar reentradas concurrentes.
  - Procesamiento de un único `mp*.txt` por ciclo para reducir contención y “saturación”.
  - Reintentos ante errores de archivo típicos (`EPERM`, `EACCES`, `EBUSY`, `EEXIST`) durante generación/envío.
  - Logging más claro del estado de envío (enviado/sin cambios/error).

## 1.0.7
Fecha de publicación: 2025-08-19
- Modo Imagen: visor responsive (420×420 inicial, redimensionable, recuerda tamaño/posición). Soporta Imágenes/PDF/Audio/Video y mantiene el último contenido en pantalla. Lee archivo de control `URI=...@VENTANA=...@INFO=...` (segmentos opcionales):
  - `VENTANA=nueva` abre visor en nueva ventana; `comun`/`comun12` usa la actual.
  - `INFO` se muestra en el título de la ventana (no tapa la imagen).
  - Manejo de `.txt` ocupado (EBUSY/EPERM/EACCES): reintenta en el próximo ciclo y limpieza opcional de `.txt` antiguos (`IMAGE_CLEANUP_ENABLED/HOURS`).
  - `public/imagen.html` ocupa 100% del área de la ventana con `object-fit: contain`. IPC: `image:test-control`, `image:new-content { filePath, info, windowMode }`.
- Navegación/Inicio por defecto: `open-view` acepta `'imagen'`. La app recuerda `DEFAULT_VIEW` (`caja` | `imagen` | `config`) y abre esa vista al iniciar.
- FTP Server integrado: servicio basado en `ftp-srv` con inicio/detención desde Administración. Configurable `FTP_SRV_HOST`, `FTP_SRV_PORT`, `FTP_SRV_USER`, `FTP_SRV_PASS`, `FTP_SRV_ROOT`, `FTP_SRV_ENABLED` (autoarranque). Estado visible con URL y raíz. Botones “Copiar URL” (usa `127.0.0.1` si host=`0.0.0.0`) y “Abrir carpeta” (normaliza la ruta y crea la carpeta si no existe). Corrección de persistencia de campos `FTP_SRV_*` y valor por defecto de raíz `C:\\tmp\\ftp_share`.
- Auto-Update: limpieza automática del directorio `pending` antes de descargar para evitar errores EPERM al renombrar; barra de progreso de descarga; Releases públicos como feed de actualización.
- UI/UX: mejoras en `public/auth.html` (tamaños de botón/título, sin scroll). Textos de ayuda en Configuración → FTP Server. Estado de servidor compacto “ON • ftp://usuario:••••@host:puerto → raíz”.
- Documentación: agregado `docs/MODO_IMAGEN.md` y `docs/doc_modo_imagen/FORMATO_CONTROL.md`. Actualizadas `docs/doc_modo_admin/CONFIG_AUTOMATIZACION.md` (intervalo remoto) y `docs/doc_modo_admin/CONFIG_FTP.md` (sección “FTP Server integrado”).

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
