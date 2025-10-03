# Notas de versión

## 1.0.20
Fecha de publicación: 2025-10-01
- Facturación (AFIP/ARCA)
  - Número oficial: se usa el número devuelto por AFIP/ARCA (CbteDesde/CbteHasta) en todo el sistema; se elimina `getLastVoucher()+1` (previene duplicados locales).
  - NC A/B (3/8) con período asociado (fallback): si falta `AFECTA FACT.N:` válido en `.fac`, se envía `PeriodoAsoc` (`FchDesde = primer día del mes de CbteFch`, `FchHasta = CbteFch`). Exclusividad asegurada: sólo `CbtesAsoc` o `PeriodoAsoc`.
  - PDF: para clase B (FB/NCB/NDB) se ocultan NETO/IVA/EXENTO y se imprime sólo `TOTAL`. Para clase A (FA/NCA/NDA) se imprime detalle completo ocultando líneas en `0,00`.
- Contingencia (.fac)
  - Idempotencia: además del `sha256`, se evita reprocesar si existe un `.res` homónimo en `out/processing/done` (`[fac.duplicate.skip]`).
  - Ruteo por tipo: detección de `TIPO:` y derivación a pipelines FAC/REC/REM. Logs al UI: “Procesando …”, “PDF OK …”, “RES OK …”.
  - Sin `.env`: rutas/tiempos/circuito fijos bajo `app.getPath('userData')`.
- Recibos y Remitos
  - `.res` incluyen `IMPORTE TOTAL` y se copia una versión a `userData/fac/out` para el resumen diario.
  - Logs a UI para inicio/fin (PDF OK / RES OK) y envío por FTP.
- Modo Caja (UI)
  - Nueva barra con iconos: Inicio, Movimientos, Facturas, Config. Se removieron "DESCARGAR MP", `auto:Desactivado`, minutero y día.
  - Visor de logs más prominente (4 líneas con scroll).
  - Pestaña “Facturas”: selector de fecha + botón “Calcular”. Tabla `Tipo | Desde | Hasta | Total` con filas fijas `FB, FA, NCB, NCA, REC, REM` y footer `Total (FA+FB)`.
  - Indicador salud AFIP/ARCA (verde/amarillo/rojo) con lógica estricta (DNS+HTTP pleno=verde; HTTP parcial/lento=amarillo; sin HTTP=rojo). Visible sólo en Inicio.
  - Ajustes de compactación para evitar scroll vertical de la ventana.
- Infraestructura / Backend
  - Nuevo handler IPC `caja:get-summary` para calcular el resumen por fecha a partir de `.res` persistidos.
  - Broadcast `ws-health-update` desde `WSHealthService` al renderer.
- Documentación
  - Actualizados `documentacion_interna/facturacion/facturacion-auditoria.md` y `documentacion_interna/doc_modo_caja/MODO_CAJA_ARQUITECTURA.md` con todos los cambios.

## 1.0.15
## 1.0.14
Fecha de publicación: 2025-01-27
- Modo Caja
  - **UI Limpia**: Eliminada la sección de información de automatización que mostraba "🤖 Facturación Automática" y detalles sobre recepción automática de datos. La interfaz ahora es más minimalista, mostrando solo el botón "DESCARGAR MP" y el área de logs.
  - **Funcionalidad Preservada**: La función `window.processAutomaticBilling(data)` sigue disponible para automatización, pero sin información visual al usuario.
- Modo Imagen - "Ir al Frente Automáticamente"
  - **VENTANA=comun**: La ventana principal ahora va automáticamente al frente cuando recibe nuevo contenido (imagen, video, etc.), sin molestar al usuario en su trabajo diario.
  - **VENTANA=nueva**: Ventanas independientes también van al frente automáticamente al recibir nuevo contenido, tanto cuando se reutiliza una ventana existente (política "Producto Nuevo") como cuando se crea una nueva.
  - **VENTANA=comun12**: Ambas ventanas (principal y espejo) van al frente simultáneamente cuando reciben nuevo contenido.
  - **Implementación Técnica**: Secuencia agresiva de activación con `show()`, `moveTop()` y temporal `setAlwaysOnTop(true/false)` para compatibilidad con Windows (sin `focus()` para no interrumpir programas externos).
  - **Comportamiento**: Solo se activa cuando llega nuevo contenido, no permanentemente, manteniendo la experiencia de usuario no intrusiva.
              - **Optimización de Apertura**: Eliminación del flickering/parpadeo en todas las ventanas del modo imagen (`VENTANA=comun`, `VENTANA=nueva`, `VENTANA=comun12`) mediante configuración inicial optimizada, posicionamiento previo al mostrar y secuencia de carga mejorada.
              - **Solución Definitiva para Ventanas al Frente**: Basada en la función original, se removió `window.focus()` que causaba interrupciones en programas externos, manteniendo `window.show()` y `window.moveTop()` para garantizar visibilidad y actualización de imágenes.
- Autenticación (Modo Administrador)
  - **Modal Personalizado**: Reemplazados todos los `alert()` nativos con un modal personalizado más amigable y funcional.
  - **Mensajes Mejorados**: Errores de login, setup, recuperación de frase secreta y OTP ahora incluyen emojis, descripciones claras y sugerencias específicas para el usuario.
  - **Manejo de Cuenta Bloqueada**: Cuando la cuenta está temporalmente suspendida por múltiples intentos fallidos, el modal muestra claramente el tiempo de desbloqueo y opciones de recuperación.
  - **UX Mejorada**: Los mensajes de error son más descriptivos y útiles, incluyendo sugerencias como "Verificar que la contraseña tenga al menos 8 caracteres" o "Revisar que el email esté correctamente escrito".
- Documentación
  - **Actualizada**: `docs/doc_modo_imagen/MODO_IMAGEN.md` con descripción de la funcionalidad "Ir al Frente Automáticamente" para todas las ventanas.
  - **Nueva**: `docs/doc_modo_imagen/IR_AL_FRENTE_AUTOMATICAMENTE.md` con documentación técnica completa de la implementación, casos de uso y compatibilidad.

## 1.0.13
Fecha de publicación: 2025-08-21
- Modo Imagen
  -Modo espejo, se saco fondo negro y se dejo fondo blanco.

## 1.0.12
Fecha de publicación: 2025-08-21
- Modo Imagen
  - Publicidad (mejorado): ventana espejo (`comun12`) ahora opera en modo kiosco + pantalla completa + siempre‑al‑frente y visible en todos los escritorios; el elemento `<video>` solicita fullscreen y el CSS (`body.publicidad`) elimina marcos/bordes y fuerza fondo negro.
  - `VENTANA=nueva` – Producto nuevo: nueva política de enfriamiento para evitar saturación de ventanas. Si llegan múltiples solicitudes dentro del intervalo, se reutiliza la última ventana y solo se refresca el contenido. Configuración en Admin → Modo Imagen (`IMAGE_PRODUCTO_NUEVO_ENABLED`, `IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS`).
  - Reproductor: videos con `autoplay + loop + muted + playsInline`; al cambiar contenido se detiene cualquier audio/video previo.
- Bandeja/Configuración
  - Guardar configuración refresca el menú de bandeja para habilitar el ítem “Publicidad” en el acto cuando `IMAGE_PUBLICIDAD_ALLOWED=true`.
- Documentación
  - Actualizados `docs/MODO_IMAGEN.md`, `docs/doc_modo_imagen/FORMATO_CONTROL.md` e informe técnico con Publicidad y Producto nuevo.

## 1.0.11
Fecha de publicación: 2025-08-20
- Automatización – disparadores inmediatos (comportamiento forzado)
  - Remoto (`AUTO_REMOTE_WATCH=true`): al llegar `mp*.txt` se ejecuta en el acto e ignora días/horas. El envío de `mp.dbf` por FTP se hace en modo forzado (no se salta por “sin cambios”). Se elimina el `.txt` procesado y se serializa la ejecución para evitar solapamientos.
  - Imagen (`IMAGE_WATCH=true`): al llegar `direccion.txt` se procesa en el acto e ignora días/horas. Se elimina el `.txt` procesado.
  - UI: textos aclaratorios en Configuración → Automatización.
  - Docs: actualizadas `docs/doc_modo_admin/CONFIG_AUTOMATIZACION.md` y `docs/doc_modo_admin/CONFIG_FTP.md`.
- Modo Imagen
  - Fallback inteligente: si falta `*.jpg`, se intenta automáticamente `*.mp4` antes de mostrar `Noimage.jpg`/`nombre_tc.png`.
  - Multi‑monitor: todas las ventanas de imagen (principal, `VENTANA=nueva`, `comun12`) guardan `displayId` y área de trabajo y restauran tamaño/posición en el mismo monitor. Menú de bandeja con “Resetear posición/tamaño (ventana actual)”.
  - Publicidad (pantalla completa): añadido modo de proyección “full full” para la ventana espejo (`comun12`). Al activar “Publicidad” (bandeja) y habilitarlo en Config, la ventana entra en modo kiosco + pantalla completa + siempre‑al‑frente y el video fuerza fullscreen del elemento; CSS específico quita marcos/bordes.
  - `VENTANA=nueva` – Producto nuevo: nueva política de enfriamiento para evitar saturación de ventanas. Si llegan múltiples solicitudes dentro del intervalo configurado, se reutiliza la última ventana `nueva` y solo se refresca el contenido. Configurable en Admin → Modo Imagen (checkbox + segundos).
  - Reproductor: videos con `autoplay + loop + muted`; al cambiar contenido, se detiene cualquier audio/video previo para evitar solapamientos.
- Modo Caja
  - Persistencia multi‑monitor de tamaño/posición (bounds por monitor) y acción de reset desde la bandeja.
- Inicio y navegación
  - Se prioriza `lastView` (última vista usada) sobre `DEFAULT_VIEW` al iniciar.
  - Administración: siempre entra por `auth.html` antes de abrir `config.html`.

## 1.0.10
Fecha de publicación: 2025-08-20
- Automatización – disparo inmediato por FTP (sin intervalo)
  - Nuevas banderas de configuración: `AUTO_REMOTE_WATCH` (Remoto) y `IMAGE_WATCH` (Modo Imagen).
  - Watchers de carpeta en el proceso principal: al finalizar una subida por FTP en las carpetas configuradas, se dispara en el acto.
    - Remoto: procesa el primer `mp*.txt` detectado (requiere `MP_ACCESS_TOKEN`).
    - Imagen: procesa `IMAGE_CONTROL_FILE` (por defecto `direccion.txt`) y muestra el contenido de `URI` inmediatamente.
  - Si ambos “watch” están activos, se desactiva el polling por intervalo para evitar trabajo duplicado.
  - Se mantiene la validación de días/horarios y la limpieza de `.txt` ocupados/antiguos.
- UI/UX – Configuración
  - Modo Remoto: controles reorganizados con texto explicativo y dos tarjetas: “Activar Modo Remoto” y “Disparo inmediato por FTP (sin intervalo)”.
  - Modo Imagen: checkbox “Disparo inmediato por FTP (sin intervalo)” con aclaración de comportamiento.
  - FTP (Cliente): agregado flujo de prueba “Elegir archivo” + “Enviar archivo por FTP” para subir cualquier archivo al servidor y validar disparadores.
- FTP – Envío manual
  - Nuevo método backend `sendArbitraryFile(localPath, remoteName?)` + IPC `ftp:send-file` y exposición en preload.
  - Útil para probar `mp.txt`/`direccion.txt` contra el FTP Server local sin herramientas externas.
- Rutas UNC y logs
  - Aclaración: las rutas UNC se usan tal cual; en los logs aparecen con barras escapadas por formato JSON, sin afectar la ejecución.
- Documentación
  - Actualizada `docs/doc_modo_admin/CONFIG_FTP.md` con disparo inmediato, pruebas de envío, limpieza y notas sobre rutas UNC/PASV/credenciales.
  - Autenticación obligatoria al abrir Administración: inicio siempre en `auth.html` si la vista por defecto es `config`.
  - Multi‑monitor: todas las ventanas (Caja, Imagen principal, `VENTANA=nueva`, `comun12`) guardan `displayId` y área de trabajo, y restauran posición/tamaño en el mismo monitor.
  - Modo Imagen: antes de `Noimage.jpg` se intenta automáticamente `*.mp4` cuando falte `*.jpg`.
  - Bandeja: nuevo ítem “Resetear posición/tamaño (ventana actual)”.
  - Inicio: se prioriza `lastView` (última vista usada) sobre `DEFAULT_VIEW`.

- Facturación (AFIP) – EN CONSTRUCCIÓN
  - Nueva sección en Configuración: “Facturación (AFIP) (en construcción)” con formularios de Empresa, Parámetros e integración AFIP; historial de PDFs locales.
  - Backend: módulo base en `src/modules/facturacion/` (tipos, `afipService` con carga diferida, `facturaGenerator` con Handlebars + Puppeteer, plantillas iniciales A/B/NC/Recibo).
  - Base de datos: tablas `empresa_config`, `parametros_facturacion` y utilidades para listar PDFs en `Documentos/facturas/`.
  - Modo Caja: botón de emisión demo oculto hasta la versión estable (flujo listo para integrar al confirmar venta).
  - Documentación: agregado `docs/doc_afip/` (README, CONFIG_AFIP, PLANTILLAS_Y_PDF, FLUJO_CAJA_ADMIN, TROUBLESHOOTING).
  - Nota: el módulo de facturación se habilitará completamente en la próxima versión; no afecta los modos existentes.

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
