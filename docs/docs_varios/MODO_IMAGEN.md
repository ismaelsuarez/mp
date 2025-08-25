# Modo Imagen – Proyección automática de contenido

## Resumen
- **Objetivo**: mostrar en pantalla (tipo proyector) una imagen/PDF/audio/video indicado por un archivo de control.
- **Uso típico**: cartelería, mostrador, kiosco de productos o avisos.
- **Estado actual**: estable con opciones de ventana (comun, nueva, comun12) y disparo inmediato por FTP.

## Características
- **Visor inicial 420×420**, redimensionable y centrado por defecto; persiste tamaño/posición por monitor (guarda `displayId` y reescala al restaurar).
- **Mantener último contenido**: la proyección permanece hasta que llegue una nueva instrucción.
- **Soporte de formatos**:
  - Imágenes: .jpg, .jpeg, .png, .gif, .bmp, .tiff, .webp
  - Documentos: .pdf (iframe)
  - Audio: .mp3, .wav, .flac, .aac, .ogg, .m4a
  - Video: .mp4, .avi, .mov, .wmv, .mkv, .webm (reproduce `autoplay + loop + muted`)

## Archivo de control
- **Ubicación**: carpeta configurable (por defecto `C:\\tmp`).
- **Nombre**: configurable (por defecto `direccion.txt`).
- **Contenido**: una sola línea con la ruta del archivo a mostrar. Se aceptan dos formatos:
  - Ruta directa: `\\servidor\\carpeta\\archivo.jpg`
  - Con prefijo: `URI=\\servidor\\carpeta\\archivo.jpg`
- **Ciclo de vida**: luego de leerla, la app elimina `direccion.txt` (consumible).
  - Si la ruta no existe y terminaba en `.jpg`, se intenta `*.mp4`; si tampoco existe, se usa el fallback (`Noimage.jpg` o `nombre_tc.png`).

## Configuración en Modo Administración
- Campos en Configuración → Modo Imagen:
  - `IMAGE_CONTROL_DIR`: carpeta donde se buscará el archivo de control (default `C:\\tmp`).
  - `IMAGE_CONTROL_FILE`: nombre del archivo de control (default `direccion.txt`).
  - `IMAGE_WINDOW_SEPARATE`: abrir el visor en una ventana aparte.
  - `IMAGE_WATCH`: disparo inmediato por FTP (sin intervalo).
  - `IMAGE_PUBLICIDAD_ALLOWED`: habilita el modo “Publicidad” en la bandeja (pantalla completa para ventana espejo `comun12`).
  - `IMAGE_PRODUCTO_NUEVO_ENABLED` + `IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS`: política de enfriamiento para `VENTANA=nueva`. Si llegan múltiples solicitudes dentro del intervalo, se reutiliza la última ventana `nueva` y se refresca el contenido.

## Automatización
- Con `IMAGE_WATCH=true`, al llegar el archivo de control se procesa de inmediato (ignora días/horas).
- Si no hay watch, el chequeo periódico respeta días/horarios de Automatización global.

## Modos de ventana (`VENTANA=`)
- `comun`: usa la ventana actual.
- `nueva`: abre una ventana independiente; se cierra con `ESC`; persiste tamaño/posición.
  - Si “Producto nuevo” está activo, dentro del intervalo configurado se **reutiliza** la última ventana y solo se refresca el contenido.
  - Si `URI` es `http/https`, se abre en el navegador del sistema.
- `comun12` (espejo): usa la ventana actual y una segunda ventana persistente para reflejo.
  - Con “Publicidad” activo (habilitado en Config y tildado en la bandeja): la ventana espejo entra en modo **kiosco + pantalla completa + siempre‑al‑frente**, sin marcos, y el video fuerza fullscreen del elemento.

## Comportamiento del visor
- Área inicial 420×420 px, redimensionable; fondo transparente (negro en “Publicidad”).
- Imágenes y video se escalan con `object-fit: contain` (sin recortes).
- PDF ocupa el recuadro completo dentro del visor.
- Audio se reproduce con controles básicos del elemento `<audio>`.

## Registro y diagnóstico
- Logs del día en `C:\\2_mp\\logs\\mp-app-YYYY-MM-DD.log`.
- Mensajes clave:
  - `Contenido de imagen procesado` – archivo mostrado correctamente.
  - `Archivo de contenido no encontrado` – la ruta indicada no existe (ver fallback).

## Roadmap (próximas mejoras)
- Zoom por rueda del mouse y doble clic (alternar “Fit/100%”).
- Impresión directa (PDF).
- Historial de contenidos mostrados.

---

Última actualización: 2025-08-21
