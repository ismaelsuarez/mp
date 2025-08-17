# Acerca de

## Objetivo
Mostrar datos de contacto de soporte y las notas de versión de la aplicación.

## Ubicación
- UI: pestaña `Acerca de` en `public/config.html`.
- Lógica: `src/renderer.ts` (carga/acciones), `src/preload.ts` (bridge), `src/main.ts` (IPC).

## Campos/Acciones
- Información de contacto: teléfono, WhatsApp, email.
- Notas de versión (solo lectura): se leen desde `docs/RELEASE_NOTES.md` y se agrupan por versión.

## Comportamiento
- Si el archivo no existe, muestra mensaje de ausencia.
- El contenido se renderiza como acordeones por cada `## x.y.z`.

## Archivo de notas
- Ruta: `docs/RELEASE_NOTES.md`.

## Referencias
- `ipcMain.handle('about:get-release-notes')`
