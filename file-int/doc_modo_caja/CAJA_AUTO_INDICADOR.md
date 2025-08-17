## CAJA – Botón/Indicador Automático y Contador

### Objetivo
Controlar rápidamente el estado del modo automático desde Caja y visualizar el tiempo restante para el próximo ciclo.

### Ubicación
- Barra inferior izquierda de Modo Caja: botón de estado y, al lado, visor de tiempo `⏱ MM:SS`.

### Estados y acciones
- **auto:On**: el auto normal está activo y contará hacia el próximo ciclo.
- **auto:Off**: el auto normal fue pausado. Click para reanudar.
- **auto:Desactivado**: no hay intervalo configurado (`AUTO_INTERVAL_SECONDS` ≤ 0). Click: informa que se debe configurar en Administración.
- **Desact.(día)**: el día actual está deshabilitado según calendario semanal.

- **Click** sobre el botón:
  - Si está activo → pausa (no ejecuta más ciclos hasta reanudar).
  - Si está pausado → reanuda con el tiempo restante o el intervalo completo.
  - Si está desactivado → muestra mensaje “Configurar en Administración”.

### Contador (⏱)
- Muestra segundos restantes del intervalo (`AUTO_INTERVAL_SECONDS`).
- Se reinicia automáticamente al completarse un ciclo (manual/auto) y al finalizar un flujo remoto si el auto estaba inactivo.
- Se actualiza por eventos `auto-timer-update` enviados desde el proceso principal.

### Flujo y notificaciones
- Mensajes recibidos por `onAutoNotice` se presentan como toasts/logs, por ejemplo:
  - `Auto-reporte generado (N)`
  - `FTP: enviado OK` / `FTP: sin cambios - no se envía` / `FTP: <error>`
  - `Se procesó archivo remoto: <nombre>`

### Notas
- El **modo remoto** es autónomo: no se pausa/reanuda con este botón. Aun así, respeta días/horarios/intervalo.
- El estado “día deshabilitado” refleja la configuración del calendario semanal en Administración.

### Referencias
- Estado/acciones IPC: `auto-status`, `auto-pause`, `auto-resume`, `auto-get-timer` y `auto-timer-update`.
- Implementación: `src/caja.ts` (UI), `src/main.ts` (timers y lógica).
