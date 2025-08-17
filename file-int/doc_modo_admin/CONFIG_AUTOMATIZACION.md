## CONFIG – Automatización

### Objetivo
Programar el ciclo automático de generación de reportes y el modo remoto (disparador por archivo), respetando días y horarios.

### Campos principales
- **Intervalo (segundos)** (`AUTO_INTERVAL_SECONDS`): ≥1 activa la automatización. 0/vacío la apaga.
- **Calendario semanal**: por cada día se define:
  - **Activo**: checkbox (`AUTO_DAYS_*`).
  - **Desde** (`AUTO_FROM_*`) y **Hasta** (`AUTO_TO_*`), formato HH:mm (opcional).
    - Ambos vacíos: todo el día.
    - Fin ≥ Inicio: rango normal.
    - Fin < Inicio: rango nocturno (ej. 22:00→02:00).

### Modo remoto (disparador por archivo)
- **Habilitar remoto** (`AUTO_REMOTE_ENABLED`): activa/desactiva el proceso remoto autónomo.
- **Carpeta remota** (`AUTO_REMOTE_DIR`): por defecto `C:\\tmp`.
- **Probar remoto ahora**: ejecuta una pasada inmediata y muestra resultado.
- Comportamiento: al encontrar `mp*.txt` ejecuta el mismo flujo que “Descargar MP”, envía `mp.dbf` por FTP y borra el archivo.
- Autonomía: remoto no se pausa con el botón auto de Caja; respeta intervalos/días/horarios.

### Acciones inferiores
- **Activar/Desactivar**: enciende/apaga el auto normal (no afecta remoto).

### Flujo
1) Verifica día/hora habilitados.
2) Si hay archivos remotos, los procesa (uno o varios) ejecutando el flujo completo y registrando `Se procesó archivo remoto: <nombre>`.
3) Si no hubo remotos, ejecuta el ciclo automático normal: consulta pagos → genera archivos → intenta FTP de `mp.dbf` → notifica a la UI.

### Persistencia y reanudación
- Si `AUTO_INTERVAL_SECONDS > 0`, al iniciar la app intenta reanudar automáticamente.
- El auto normal soporta pausa/reanudación (mantiene tiempo restante). El remoto opera con su propio timer, independiente.

### Notas UX
- Calendario semanal unificado (día, activo, desde, hasta) para reducir redundancia y mejorar legibilidad.
- Inputs de hora con ancho adecuado; contenedor sin recortes.

### Referencias
- Implementación: `src/main.ts` (timers, remoto y flujo), `src/renderer.ts` (UI y botones), `public/config.html` (estructura).
