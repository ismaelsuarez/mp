# Acerca de

## Objetivo
Mostrar datos de contacto de soporte y las notas de versión de la aplicación.

## Ubicación
- UI: pestaña `Acerca de` en `public/config.html`.
- Lógica: `src/renderer.ts` (carga/acciones), `src/preload.ts` (bridge), `src/main.ts` (IPC).

## Campos/Acciones
- Información de contacto: teléfono, WhatsApp, email.
- Versión instalada: se obtiene vía IPC `get-app-version`.
- Notas de versión (solo lectura):
  - Recargar: lee `docs/RELEASE_NOTES.md` y lo muestra.
  - Edición: se realiza fuera de la app (archivo en `docs/RELEASE_NOTES.md`). La app no permite edición.

## Comportamiento
- Si el archivo no existe, el handler devolverá un mensaje de ausencia. No se crea automáticamente.
- El contenido se renderiza en un `<pre>` con salto de línea preservado.

## Archivo de notas
- Ruta: `docs/RELEASE_NOTES.md`.
- Formato sugerido: Markdown con secciones `## x.y.z` y lista de cambios.

## Referencias
- `ipcMain.handle('about:get-release-notes')`
