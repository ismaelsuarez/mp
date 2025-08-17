## CAJA – Badge “Hoy”

### Objetivo
Mostrar la fecha operativa del sistema para referencia rápida.

### Ubicación
- Barra inferior derecha en Modo Caja.

### Comportamiento
- Al cargar Caja, calcula `YYYY-MM-DD` y la muestra (no hace polling). 
- Útil para validar a simple vista que los archivos generados correspondan al día esperado.

### Referencias
- Implementación: `src/caja.ts` (`renderTodayBadge`).
