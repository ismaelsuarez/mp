## CONFIG – Automatización

### Objetivo
Programar el ciclo automático y el modo remoto (disparador por archivo).

### Campos
- Intervalo (segundos)
- Calendario semanal: Activo / Desde / Hasta
- Modo remoto: Habilitar y Carpeta remota (C:\\tmp)
- Probar remoto ahora

### Comportamiento
- Remoto procesa `mp*.txt`, ejecuta el flujo de reporte y envía `mp.dbf` por FTP.
- Remoto es autónomo (no se pausa con auto on/off), pero respeta intervalos/días/horas.

### Referencias
- `src/main.ts`, `src/renderer.ts`, `public/config.html`
