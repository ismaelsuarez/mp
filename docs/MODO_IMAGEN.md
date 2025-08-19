# Modo Imagen – Proyección automática de contenido

## Resumen
- **Objetivo**: mostrar en pantalla (tipo proyector) una imagen/PDF/audio indicado por un archivo de control.
- **Uso típico**: cartelería, mostrador, kiosco de productos o avisos.
- **Estado actual**: implementación básica funcionando y en iteración.

## Características
- **Visor 400×400** centrado en pantalla (modo presentación, sin marcos ni barras).
- **Botón Probar** (esquina superior derecha, tamaño reducido) para forzar una lectura manual durante pruebas.
- **Mantener último contenido**: la proyección permanece hasta que aparezca una nueva instrucción.
- **Soporte de formatos**:
  - Imágenes: .jpg, .jpeg, .png, .gif, .bmp, .tiff, .webp
  - Documentos: .pdf (render en iframe)
  - Audio: .mp3, .wav, .flac, .aac, .ogg, .m4a
  - Video (base para futuro): .mp4, .avi, .mov, .wmv, .mkv, .webm

## Archivo de control
- **Ubicación**: carpeta configurable (por defecto `C:\\tmp`).
- **Nombre**: configurable (por defecto `direccion.txt`).
- **Contenido**: una sola línea con la ruta del archivo a mostrar. Se aceptan dos formatos:
  - Ruta directa: `\\servidor\\carpeta\\archivo.jpg`
  - Con prefijo: `URI=\\servidor\\carpeta\\archivo.jpg`
- **Ciclo de vida**: luego de leerla, la app elimina `direccion.txt` (consumible). Si la ruta no existe, registra el evento y también limpia el archivo de control.

## Configuración en Modo Administración
- Campos en Configuración → Modo Imagen:
  - `IMAGE_CONTROL_DIR`: carpeta donde se buscará el archivo de control (default `C:\\tmp`).
  - `IMAGE_CONTROL_FILE`: nombre del archivo de control (default `direccion.txt`).
  - `IMAGE_INTERVAL_SECONDS`: intervalo propio (segundos). Si se define, **sobrescribe** el intervalo global de automatización.
  - `IMAGE_WINDOW_SEPARATE`: abrir el visor en una ventana aparte (opcional). Si no se marca, se muestra embebido.

## Automatización
- El chequeo se ejecuta de forma periódica respetando:
  - Días y horarios habilitados en la sección de automatización.
  - Intervalo global `AUTO_INTERVAL_SECONDS`, a menos que se defina `IMAGE_INTERVAL_SECONDS` (este tiene prioridad).
- Cuando detecta `direccion.txt`:
  1. Lee la ruta (admite `URI=` o directa).
  2. Verifica existencia del archivo destino.
  3. Muestra el contenido (escala con `object-fit: contain` dentro de 400×400).
  4. Elimina `direccion.txt`.

## Accesos
- Menú de bandeja (icono junto al reloj): `Ir a Imagen` abre directamente el Modo Imagen.
- Desde la interfaz (según navegación implementada) también se puede abrir `imagen.html`.

## Comportamiento del visor
- Área fija 400×400 px, centrada, fondo transparente.
- Imágenes y video se escalan manteniendo proporción (no se recortan).
- PDF ocupa el recuadro completo dentro del visor.
- Audio se reproduce con controles básicos del elemento `<audio>` cuando corresponda.

## Botón “Probar” (solo en desarrollo)
- Ubicado arriba a la derecha.
- Ejecuta lectura inmediata de `direccion.txt` sin esperar el intervalo.
- Recomendado para validar rutas UNC o comprobar permisos de lectura.

## Registro y diagnóstico
- Logs generales del día en `C:\\2_mp\\logs\\mp-app-YYYY-MM-DD.log`.
- Mensajes clave:
  - `Contenido de imagen procesado` – archivo mostrado correctamente.
  - `Archivo de contenido no encontrado` – la ruta indicada en `direccion.txt` no existe.

## Requisitos y permisos
- El usuario de Windows que ejecuta la app debe tener **lectura** sobre la ruta indicada (especialmente en rutas UNC `\\servidor\\...`).
- Antivirus: si bloquea rutas UNC o PDFs, agregue exclusión para la carpeta destino o el proceso de la app.

## Roadmap (próximas mejoras)
- Zoom por rueda del mouse y doble clic (alternar “Fit/100%”).
- Tecla `F` para pantalla completa.
- Impresión directa (PDF): comando desde el visor.
- Historial de contenidos mostrados.

## Preguntas frecuentes
- **¿Qué pasa si el archivo de control está vacío?**
  - Se elimina y no cambia la proyección.
- **¿Puedo usar rutas con espacios?**
  - Sí. Use rutas correctamente escapadas en `direccion.txt`.
- **¿Se puede aumentar el tamaño del visor?**
  - Sí, pero el concepto de “marco fijo 400×400” está pensado para comportamiento tipo cuadro. Se puede parametrizar si se necesita.

---

Última actualización: 2025-08-19
