## CONFIG – Automatización

### Objetivo
Programar el ciclo automático y gestionar los disparadores (remoto e imagen).

### Campos
- **Intervalo (segundos)** `AUTO_INTERVAL_SECONDS`
- **Calendario semanal**: Activo / Desde / Hasta (`AUTO_DAYS_*`, `AUTO_FROM_*`, `AUTO_TO_*`)
- **Modo remoto**:
  - Carpeta remota (C:\tmp) `AUTO_REMOTE_DIR`
  - Intervalo remoto (ms) `AUTO_REMOTE_MS_INTERVAL`
  - Habilitar remoto `AUTO_REMOTE_ENABLED`
  - Disparo inmediato por FTP `AUTO_REMOTE_WATCH`
  - Probar remoto ahora (ejecuta una vez)
- **Modo imagen**:
  - Carpeta/archivo control `IMAGE_CONTROL_DIR` / `IMAGE_CONTROL_FILE`
  - Disparo inmediato `IMAGE_WATCH`
  - Limpieza automática `IMAGE_CLEANUP_ENABLED` / `IMAGE_CLEANUP_HOURS`

### Comportamiento
- **Intervalos**
  1) Si está definido `AUTO_REMOTE_MS_INTERVAL` (>0), el remoto usa ese valor.
  2) Si no, se usa `AUTO_INTERVAL_SECONDS` convertido a ms.
- **Calendario semanal**
  - Aplica al ciclo por intervalo. Fuera de la ventana, el automático por intervalo no corre.
- **Disparadores (forzados)**
  - Remoto (`AUTO_REMOTE_WATCH=true`) y Modo Imagen (`IMAGE_WATCH=true`) son disparadores por eventos de archivo y se ejecutan SIEMPRE, ignorando días/horas y cualquier control de “ya se envió”.
  - En remoto, el envío FTP de `mp.dbf` se hace en modo forzado (no se salta por “sin cambios”).
  - En imagen, al detectar `direccion.txt` se procesa inmediatamente el contenido indicado (incluye fallback `jpg→mp4→Noimage.jpg`).

### Flujo remoto
- Detecta `mp*.txt` en `AUTO_REMOTE_DIR` y ejecuta el reporte, generando salidas y enviando `mp.dbf` por FTP (forzado).
- Limpia el `.txt` procesado.

### Referencias
- `src/main.ts` (timers, watchers e IPC)
- `src/services/FtpService.ts` (envío FTP con opción `force`)
- `public/config.html`, `src/renderer.ts` (UI)
