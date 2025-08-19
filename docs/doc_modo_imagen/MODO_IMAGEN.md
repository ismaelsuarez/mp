# Modo Imagen – Visualización remota y proyección

## Objetivo
Mostrar en pantalla contenidos indicados por un archivo de control (imágenes, PDF, audio y video). Pensado para cartelería, mostradores o kioscos.

## Acceso
- Menú de bandeja: opción `Ir a Imagen`.
- Desde Configuración: botón `Modo Imagen`.
- Vista predeterminada: la app recuerda la última vista usada. Si dejas seleccionada la vista Imagen, al reiniciar abrirá directamente en modo Imagen (y lo mismo para Caja).

## Comportamiento general
- Escaneo periódico del archivo de control configurable (ver Configuración).
- Al detectar el archivo de control, lee la ruta del contenido, muestra el archivo en el visor y elimina el .txt de control.
- El último contenido mostrado queda persistente en pantalla hasta que llegue otro.
- Limpieza automática opcional de .txt antiguos para evitar acumulación.

## Formato del archivo de control
- Carpeta: configurable (por defecto `C:\\tmp`).
- Nombre: configurable (por defecto `direccion.txt`).
- Contenido: una línea con la ruta completa al archivo a mostrar. Se admiten dos variantes:
  - Ruta directa: `\\servidor\\carpeta\\archivo.jpg`
  - Prefijo explícito: `URI=\\servidor\\carpeta\\archivo.jpg`
- Si la ruta no existe, se registra el evento y el .txt se elimina igualmente.

## Formatos soportados
- Imágenes: jpg, jpeg, png, gif, bmp, tiff, webp
- Documentos: pdf (embed en `<iframe>`)
- Audio: mp3, wav, flac, aac, ogg, m4a
- Video: mp4, avi, mov, wmv, mkv, webm

## Modo ventana (responsive)
- La vista Imagen abre inicialmente en 420×420 px.
- La ventana se puede redimensionar libremente con el mouse y la app recuerda tamaño y posición para la próxima vez, ajustando a la resolución del monitor.
- El visor ocupa el 100% del área de la ventana, centrando y escalando el contenido con `object-fit: contain` (sin recortes).

## Configuración (Administración → Automatización / Modo Imagen)
- `IMAGE_CONTROL_DIR`: carpeta donde se busca el .txt (default `C:\\tmp`).
- `IMAGE_CONTROL_FILE`: nombre del archivo de control (default `direccion.txt`).
- `IMAGE_INTERVAL_MS`: intervalo propio del Modo Imagen en milisegundos. Si se define, tiene prioridad sobre el intervalo global.
- `IMAGE_WINDOW_SEPARATE`: abrir el visor en una ventana separada (opcional).
- `IMAGE_ENABLED` (implícito ON): permite desactivar sólo el escaneo de imagen.
- `IMAGE_CLEANUP_ENABLED` (por defecto ON): habilita limpieza automática de .txt antiguos.
- `IMAGE_CLEANUP_HOURS` (default 24): antigüedad (en horas) para eliminar .txt residuales.
- `AUTO_REMOTE_MS_INTERVAL`: intervalo del Modo Remoto (independiente, también respeta días/horarios).
- `AUTO_REMOTE_ENABLED`: enciende/apaga el Modo Remoto (independiente).
- `DEFAULT_VIEW`: `caja` | `imagen` | `config`. La app recuerda la última vista utilizada.

## Automatización y prioridades de intervalo
- El escaneo de Imagen respeta días y horarios configurados en la grilla semanal.
- Prioridad de intervalos para Imagen:
  1) `IMAGE_INTERVAL_MS` (si está definido y > 0)
  2) En su defecto, el intervalo global `AUTO_INTERVAL_SECONDS` (convertido a ms)
- El botón `Activar` enciende los timers disponibles: global, remoto y el de imagen. El botón `Desactivar` los apaga.
- Guardar configuración reinicia los timers para aplicar cambios.

## Buenas prácticas de uso
- Preferir rutas UNC estables (`\\servidor\\recurso\\archivo.ext`). Verificar permisos de lectura del usuario que ejecuta la app.
- Evitar intervalos demasiado bajos (por ej. < 500 ms) para no aumentar uso de disco/CPU.
- Mantener el antivirus con exclusión para la carpeta de control si observas bloqueos o demoras.

## Solución de problemas
- “No se encontró archivo de contenido”
  - La ruta indicada en el .txt no existe o no es accesible. Revisar permisos de red/UNC y que el archivo no haya sido movido.
- “No aparece la imagen y se borra el .txt”
  - Es el comportamiento esperado cuando el destino no existe. El disparador se consume para permitir uno nuevo.
- “Persiste un .txt y no cambia la imagen”
  - Revisar que el .txt tenga contenido válido y sin espacios invisibles al final. La limpieza automática borra .txt muy antiguos según `IMAGE_CLEANUP_HOURS`.

## Archivos y referencias
- Lógica principal: `src/main.ts`
  - `processImageControlOnce` (lectura/consumo del .txt y notificación al renderer)
  - `startImageTimer` / `stopImageTimer` (timer dedicado)
  - Limpieza: `cleanupImageArtifacts`
  - Persistencia de ventana: `saveImagenWindowBounds` / `restoreImagenWindowBounds`
- UI del visor: `public/imagen.html`, `src/imagen.ts`
- Exposición de APIs: `src/preload.ts`
- Configuración/UX administración: `public/config.html`, `src/renderer.ts`

---
Última actualización: 2025-08-19
