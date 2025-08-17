## CAJA – Pestaña Movimientos

### Objetivo
Mostrar rápidamente los últimos movimientos tras una ejecución (manual/automática/remota) en una vista compacta.

### Ubicación
- Tab `Movimientos` en Modo Caja.

### Columnas y formato
- **ID**: identificador de pago.
- **Estado**: con color y traducción automática:
  - approved → Aprobado (verde)
  - cancelled → Cancelado (rojo)
  - refunded → Reintegrada (amarillo)
- **Monto**: valor numérico con 2 decimales.
- **Fecha/hora**: `DD/MM/YYYY HH:MM` (hora local). Maneja valores inválidos mostrando la cadena original.

### Comportamiento
- Renderiza los 5 registros más recientes para mejor legibilidad en ventana compacta.
- Se refresca al finalizar:
  - “Descargar MP” en Caja.
  - Un ciclo automático (si trajo datos).
  - Un ciclo remoto (si se procesaron triggers `mp*.txt`).
- También se actualiza cuando llegan mensajes por `onAutoNotice`.

### Notas
- La tabla de resultados completa y exportaciones están en Administración → Resultados.

### Referencias
- Implementación: `src/caja.ts` (`renderLast8`, formato de fecha/estado).
