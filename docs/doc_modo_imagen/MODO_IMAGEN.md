# Modo Imagen – Visualización remota y proyección

## Objetivo
Mostrar en pantalla contenidos indicados por un archivo de control (imágenes, PDF, audio y video). Pensado para cartelería, mostradores o kioscos.

## Acceso
- Menú de bandeja: opción `Ir a Imagen`.
- Desde Configuración: botón `Modo Imagen`.
- Vista predeterminada: la app recuerda la última vista usada. Si dejas seleccionada la vista Imagen, al reiniciar abrirá directamente en modo Imagen (y lo mismo para Caja).

## Comportamiento general
- Disparo inmediato por FTP (opcional): si está activado, al terminar de subirse el archivo de control se procesa en el acto (sin intervalos).
- Escaneo periódico (fallback): si el disparo inmediato está desactivado, se puede usar intervalo de escaneo configurable.
- Al detectar el archivo de control, lee la ruta del contenido, muestra el archivo en el visor y elimina el .txt de control.
- El último contenido mostrado queda persistente en pantalla hasta que llegue otro.
- Limpieza automática opcional de .txt antiguos para evitar acumulación.

## Formato del archivo de control
- Carpeta: configurable (por defecto `C:\\tmp`).
- Nombre: configurable (por defecto `direccion.txt`).
- Contenido: una línea con la ruta completa al archivo a mostrar. Se admiten:
  - Ruta directa: `\\servidor\\carpeta\\archivo.jpg`
  - Prefijo explícito con metadatos: `URI=RUTA@VENTANA=OPCION@INFO=DESCRIPCION`
    - `URI`: ruta absoluta del contenido (local o UNC).
    - `VENTANA`: `comun` | `nueva` | `comun12` (ver Modos de ventana).
    - `INFO`: texto para el título de la ventana.
- Si la ruta no existe, se registra el evento y el .txt se elimina igualmente. Antes de mostrar el fallback visual, si la `URI` terminaba en `.jpg` se prueba automáticamente la variante `.mp4` con el mismo nombre; si existe, se muestra el video. Si tampoco existe, se usa el fallback (`public/Noimage.jpg` o `nombre_tc.png`).

## Formatos soportados
- Imágenes: jpg, jpeg, png, gif, bmp, tiff, webp
- Documentos: pdf (embed en `<iframe>`)
- Audio: mp3, wav, flac, aac, ogg, m4a
- Video: mp4, avi, mov, wmv, mkv, webm

Rutas soportadas:
- Local y UNC: `C:\\...`, `\\\\servidor\\share\\carpeta\\archivo.ext` (recomendado). La app usa la ruta tal cual llega; en los logs JSON las barras invertidas pueden verse duplicadas por escape.
- Web `http/https` con `VENTANA=nueva`: se abre en el navegador predeterminado del sistema.

## Modos de ventana y comportamiento
- Responsive: abre inicialmente en 420×420 px; se puede redimensionar libremente y recuerda tamaño/posición por monitor (guarda `displayId` y área de trabajo). Al restaurar, reescala y ubica en el mismo monitor si está disponible. El visor ocupa el 100% del área con `object-fit: contain`.
- `VENTANA=comun`: muestra en la ventana principal de la app. La ventana va automáticamente al frente cuando recibe nuevo contenido.
- `VENTANA=nueva`: abre un visor en una nueva ventana; primera vez centrada en el mismo monitor, siguientes veces restaura tamaño/posición guardados por monitor. Cierra con tecla ESC. Menú oculto para presentación limpia. La ventana va automáticamente al frente cuando recibe nuevo contenido.
- `VENTANA=comun12`: muestra en la ventana principal y además en una segunda ventana persistente ("espejo") que se reutiliza y recuerda tamaño/posición por monitor. Ambas ventanas van automáticamente al frente cuando reciben nuevo contenido.
- Título: usa `INFO` (o el nombre del archivo) y no tapa el contenido.

## Configuración (Administración → Automatización / Modo Imagen)
- `IMAGE_CONTROL_DIR`: carpeta donde se busca el .txt (default `C:\\tmp`).
- `IMAGE_CONTROL_FILE`: nombre del archivo de control (default `direccion.txt`).
- `IMAGE_WATCH`: Disparo inmediato por FTP (sin intervalo). Reacciona apenas llega el archivo de control a la carpeta.
- `IMAGE_INTERVAL_MS`: intervalo propio de Imagen (si no se usa el disparo inmediato). Si se define, tiene prioridad sobre el intervalo global.
- `IMAGE_WINDOW_SEPARATE`: abrir el visor en una ventana separada (opcional; complementa `VENTANA=nueva`).
- `IMAGE_ENABLED` (implícito ON): permite desactivar sólo el escaneo/procesamiento de imagen.
- `IMAGE_CLEANUP_ENABLED` (por defecto ON): habilita limpieza automática de .txt antiguos.
- `IMAGE_CLEANUP_HOURS` (default 24): antigüedad (en horas) para eliminar .txt residuales.
- `DEFAULT_VIEW`: `caja` | `imagen` | `config`. La app recuerda la última vista utilizada.

## Automatización y prioridades de ejecución
- Disparo inmediato (si `IMAGE_WATCH`=true): no usa intervalos; procesa eventos de llegada de archivo en la carpeta configurada.
- Escaneo por intervalo (si `IMAGE_WATCH`=false): respeta días y horarios configurados en la grilla semanal.
- Prioridad de intervalos cuando aplica:
  1) `IMAGE_INTERVAL_MS` (si está definido y > 0)
  2) En su defecto, el intervalo global `AUTO_INTERVAL_SECONDS` (convertido a ms)
- El botón `Activar` enciende los timers disponibles; `Desactivar` los apaga. Guardar configuración reinicia watchers/timers para aplicar cambios.

## Buenas prácticas de uso
- Preferir rutas UNC estables (`\\servidor\\recurso\\archivo.ext`). Verificar permisos de lectura del usuario que ejecuta la app.
- Evitar intervalos demasiado bajos (por ej. < 500 ms) para no aumentar uso de disco/CPU.
- Mantener el antivirus con exclusión para la carpeta de control si observas bloqueos o demoras.

## Limpieza y solución de problemas
- Limpieza: tras procesar, el `.txt` se elimina. Si el archivo está ocupado (EBUSY/EPERM/EACCES), se reintenta en el siguiente evento/ciclo. Con `IMAGE_CLEANUP_ENABLED/HOURS` se borran `.txt` muy antiguos de la carpeta de control.
- “No se encontró archivo de contenido”
  - La ruta indicada en el .txt no existe o no es accesible. Revisar permisos de red/UNC y que el archivo no haya sido movido.
- “No aparece la imagen y se borra el .txt”
  - Es el comportamiento esperado cuando el destino no existe. El disparador se consume para permitir uno nuevo.
- “Persiste un .txt y no cambia la imagen”
  - Revisar que el .txt tenga contenido válido y sin espacios invisibles al final. La limpieza automática borra .txt muy antiguos según `IMAGE_CLEANUP_HOURS`.
- Rutas UNC: si solicita credenciales, mapeá acceso persistente (ej.: `net use \\servidor\share /user:USUARIO CONTRASEÑA /persistent:yes`).

### Multi‑monitor y reset manual
- La app recuerda el monitor donde se usó cada ventana (principal, `nueva`, `comun12`) y restaura allí cuando sea posible.
- Si una pantalla ya no está conectada o cambió la geometría, se reubica automáticamente dentro del área visible del monitor disponible.
- Menú de bandeja → “Resetear posición/tamaño (ventana actual)”: borra las coordenadas guardadas y centra con tamaño por defecto.

## Archivos y referencias
- Lógica principal: `src/main.ts`
  - `processImageControlOnce` (lectura/consumo del .txt y notificación al renderer)
  - Disparo inmediato: `startImageWatcher()` (watcher de carpeta) y reinicio con `restartWatchersIfNeeded()`
  - Escaneo por intervalo: `startImageTimer` / `stopImageTimer`
  - Limpieza: `cleanupImageArtifacts`
  - Persistencia de ventana: `saveImagenWindowBounds` / `restoreImagenWindowBounds` y ventanas nuevas/duplicadas
- UI del visor: `public/imagen.html`, `src/imagen.ts`
- Exposición de APIs: `src/preload.ts`
- Configuración/UX administración: `public/config.html`, `src/renderer.ts`

---
Última actualización: 2025-08-20 (multi‑monitor, fallback jpg→mp4, reset de ventana)
