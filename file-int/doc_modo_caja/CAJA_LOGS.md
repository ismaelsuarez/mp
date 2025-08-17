## CAJA – Panel de Logs

### Objetivo
Brindar feedback inmediato y minimalista sobre las últimas acciones/errores.

### Ubicación
- Debajo del botón “Descargar MP” en Modo Caja.

### Comportamiento
- Mantiene una ventana de 3 líneas (más recientes) con timestamp local `[HH:MM:SS]`.
- Muestra eventos relevantes:
  - Inicio/fin de generación manual.
  - Notificaciones de auto/remoto.
  - Resultado de FTP: enviado, sin cambios, errores.
  - Mensajes informativos (día no habilitado, etc.).

### Notas
- Es un log visual de “paso rápido”; los logs persistentes diarios van a `logs/YYYY-MM-DD.log`.

### Referencias
- Implementación: `src/caja.ts` (`appendLog`) y `onAutoNotice`.
