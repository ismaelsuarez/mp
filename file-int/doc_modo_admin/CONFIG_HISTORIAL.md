## CONFIG – Historial

### Objetivo
Consultar rápidamente qué archivos se generaron por día y abrir la carpeta de salida.

### Acciones
- **Actualizar historial**: escanea la carpeta de salida y agrupa por fecha (`YYYY-MM-DD`).
- **Abrir carpeta de reportes**: abre el directorio en el explorador.

### Detalles
- Detecta archivos con prefijos conocidos: `balance-`, `transactions-`, `transactions-full-`, `transactions-detailed-`.

### Referencias
- Implementación: `src/main.ts` (handlers `list-history`, `open-out-dir`), `src/renderer.ts` (UI).
