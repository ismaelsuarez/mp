## Modo Imagen – Ventana Emergente (desacoplada)

### Objetivo
Permitir que el visor de contenidos (imágenes, PDF, audio, video) funcione en una ventana propia, independiente del resto de la app, conservando tamaño y posición, y mostrando una cabecera simple con título y botón de cierre.

### Resumen técnico
- Ventana dedicada: `imageWindow` (Electron) en `src/main.ts`.
- Ventana sin marco (frameless) con barra superior propia en `public/imagen.html`.
- Título muestra la descripción opcional provista por el archivo de control (`@INFO=`).
- Único botón activo: Cerrar (✕). Minimizar/maximizar se deshabilitaron por requerimiento.
- Persistencia: guarda bounds (x, y, width, height) en `settings.json` → clave `imageWindowBounds` (ver manejo en `src/main.ts`).
- Auto-escalado: el contenido se ajusta con `object-fit: contain` y `max-width/max-height: 100%`. Nunca se recorta ni sale del visor; al maximizar la ventana, gana calidad/área.
- Integración de timers: se usa el mismo intervalo que «modo remoto» (unificado). Prioridad: primero `mp*.txt`, luego `direccion.txt`.

### Archivo de control (recordatorio)
Ver `FORMATO_CONTROL.md`. Ejemplos válidos (línea única):

```text
URI=\\servidor\carpeta\imagen.jpg@INFO=(A123) GPU GIGABYTE 4060 8G
```

Campos soportados:
- `URI=…` (obligatorio): ruta absoluta (local/UNC) del recurso a mostrar.
- `@INFO=…` (opcional): texto mostrado en el título de la ventana (barra verde).

### Flujo de ejecución (alto nivel)
1. El timer unificado detecta `direccion.txt` en `IMAGE_CONTROL_DIR/IMAGE_CONTROL_FILE`.
2. Lee y parsea `URI` y `INFO` (si existen). Verifica existencia del recurso.
3. Si la ventana de imagen no está creada, se crea (`createOrShowImageWindow()`), luego se envía `image:new-content`.
4. En el renderer (`src/imagen.ts`), se crea el elemento correspondiente (`<img>`, `<video>`, `<audio>`, `<iframe>`) y se ajusta al área visible.
5. El título de la barra se actualiza con `INFO` o, si no existe, con `Tipo: nombreDeArchivo`.
6. Se elimina `direccion.txt` tras procesar.

### Configuración
- Carpeta/archivo de control: en `Configuración → Automatización → 📷 Modo Imagen`.
- Color de la barra: fijo en CSS (no editable por UI). Para cambiarlo manualmente: `public/imagen.html`, regla `.titlebar { background: #10b981; }`.
- Ventana separada: el modo emergente es el comportamiento por defecto al llegar contenido de imagen. (La app también puede abrir la vista imagen desde el tray/menú.)

### Ubicaciones relevantes
- Ventana y persistencia: `src/main.ts` (funciones `createOrShowImageWindow()`, `processImageControlOnce()`).
- Puente IPC: `src/preload.ts` (método `setWindowState` para cerrar).
- Renderer (visor): `src/imagen.ts` (detección de tipo y render de contenido). 
- Estructura y estilos: `public/imagen.html`.

### Consideraciones de UX
- La ventana recuerda su tamaño y posición; al reabrir, restaura los últimos bounds válidos.
- El contenido se muestra centrado y completo; para ver mayor detalle, ampliar la ventana.
- El botón de cierre funciona vía IPC; si no está disponible (desarrollo), realiza un cierre local (`window.close()` fallback).

### Pruebas recomendadas
1. Crear `C:\tmp\direccion.txt` con `URI` a una imagen grande y `@INFO=…`. Confirmar:
   - La ventana se abre (o se enfoca) y el título refleja el `INFO`.
   - La imagen queda centrada y dentro del área visible (sin barras ni recortes).
2. Redimensionar y mover la ventana; cerrar y reabrir: verificar que restaure tamaño/posición.
3. Probar PDF (`.pdf`), audio (`.mp3`, `.wav`) y video (`.mp4`) para confirmar escalado/centrado.
4. Enviar `mp*.txt` y `direccion.txt` simultáneamente: verificar prioridad (primero remoto, luego imagen).

### Troubleshooting
- La ventana no cierra: revisar IPC (`window:set-state`). En desarrollo, el fallback `window.close()` debe cerrar.
- No se ve la imagen: comprobar ruta UNC/permisos y que el archivo exista; ver logs del proceso principal.
- Desalineación/espacios: confirmar que `public/imagen.html` mantenga `.container { position: fixed; top:32px; left:0; right:0; bottom:0; display:grid; place-items:center; }`.

### Roadmap (opcional)
- Zoom con rueda + arrastre (pan).
- Atajos de teclado (Esc para cerrar, Ctrl+0 para ajustar a ventana, Ctrl++/− zoom).
- Opción UI para color de barra (si se decide reexponer en ajustes).

### Cambios respecto al modo acoplado (anterior)

Antes: el visor compartía la ventana principal y la descripción se superponía al contenido (barra interna). Los timers de remoto e imagen podían competir; el color de la barra era configurable desde la UI.

Ahora (desacoplado/emergente):
- Ventana propia `imageWindow` (frameless) con barra superior y botón de cierre.
- El evento `image:new-content` se dirige a `imageWindow`; si no existe, se crea y luego se envía (evita que el contenido caiga en otra vista).
- Persistencia de tamaño/posición en `imageWindowBounds` (restauración al abrir).
- Escalado garantizado (contain + max-width/max-height 100%) y centrado real del contenido; sin overlays sobre la imagen.
- Descripción (`@INFO=`) va al título de la barra, no sobre el contenido.
- Minimizar/maximizar deshabilitados; solo Close (con fallback `window.close()` si IPC no está disponible).
- Intervalos unificados: un solo timer con prioridad (remoto → imagen) para evitar saturación.
- Color de barra fijo en CSS (`.titlebar { background: #10b981; }`); se quitó el campo de configuración `IMAGE_INFOBAR_COLOR`.

Archivos tocados (principalmente):
- `src/main.ts`: `createOrShowImageWindow`, enrutamiento a `imageWindow`, persistencia de bounds, close por IPC.
- `public/imagen.html`: barra personalizada, logo, botón Close, layout y estilos de centrado/contain.
- `src/imagen.ts`: recepción de `INFO`, título, creación de elementos (`img/video/audio/iframe`) con contain, eliminación de barra interna superpuesta.
- `src/preload.ts` y `types/global.d.ts`: API `setWindowState` para cerrar ventana.


