## CONFIG – Automatización

### Objetivo
Programar el ciclo automático y el modo remoto (disparador por archivo).

### Campos
- Intervalo (segundos)
- Calendario semanal: Activo / Desde / Hasta
- Modo remoto:
  - Carpeta remota (C:\\tmp)
  - Intervalo remoto (ms)
  - Habilitar remoto
  - Probar remoto ahora

### Comportamiento
- Remoto procesa `mp*.txt`, ejecuta el flujo de reporte y envía `mp.dbf` por FTP.
- Remoto respeta los **días** y **rangos horarios** configurados.
- El tiempo de ejecución de Remoto se controla así (prioridad):
  1) Si se define **Intervalo remoto (ms)**, usa ese valor.
  2) En caso contrario, usa el **Intervalo (segundos)** global convertido a ms.
- Recomendado para Intervalo remoto: **60000 ms** (1 minuto). Valores muy bajos pueden aumentar el uso de CPU/IO.

### Referencias
- `src/main.ts`, `src/renderer.ts`, `public/config.html`
