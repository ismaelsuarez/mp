## CAJA – Botón "DESCARGAR MP"

Esta guía explica el comportamiento del botón "DESCARGAR MP" (`btnCajaGenerate`) en `public/caja.html` y su flujo técnico asociado.

## Resumen

Al hacer clic, se genera un reporte de pagos de Mercado Pago con la configuración vigente y se exportan archivos (CSV/XLSX/DBF/JSON). El resultado se refleja en los logs de la vista y en la tabla de "Movimientos" con los últimos registros.

> Nota: El modo remoto en Automatización ejecuta el mismo flujo cuando detecta archivos `mp*.txt` en la carpeta configurada.

## Flujo detallado

1. UI (`src/caja.ts`):
   - Registra en pantalla: "Generando reporte...".
   - Llama a `window.api.generateReport()`.
2. Proceso en `main` (`src/main.ts` – handler `generate-report`):
   - Ejecuta `searchPaymentsWithConfig()` usando la configuración actual (token, filtros, fechas, etc.).
   - Genera archivos con `generateFiles(payments, tag, range)`:
     - `balance-YYYY-MM-DD.json`
     - `transactions-YYYY-MM-DD.csv`
     - `transactions-full-YYYY-MM-DD.csv`
     - `transactions-full-YYYY-MM-DD.xlsx`
     - `transactions-detailed-YYYY-MM-DD.dbf`
   - Intenta enviar por FTP el `mp.dbf` del día (si existe):
     - Si no cambió respecto al último envío: lo omite ("sin cambios").
     - Si hay cambios: lo envía y notifica "enviado OK".
   - Devuelve a la UI: `{ count, outDir, files, rows }` (con `rows` recortado para UI).
   - Notifica a la UI eventos/errores por canal `auto-report-notice` (también visibles en Caja).
3. UI (`src/caja.ts`):
   - Registra: `Reporte generado: N pagos`.
   - Actualiza la tabla de "Movimientos" mostrando 5 registros recientes (ID, Estado, Monto, Fecha/Hora):
     - Formatea fecha/hora a `DD/MM/YYYY HH:MM`.
     - Traduce estados comunes: `approved → Aprobado`, `cancelled → Cancelado`, `refunded → Reintegrada` y aplica color.
   - También refleja notificaciones provenientes de `auto-report-notice` (p. ej., mensajes de FTP o errores).

## Dónde quedan los archivos

- Se guardan en la carpeta de salida de la app ("carpeta de reportes").
- Los nombres siguen el patrón por fecha del día (`YYYY-MM-DD`).
- Desde la vista de Configuración hay acciones para abrir la carpeta de reportes y listar historial.

## Requisitos previos

- Configurar correctamente Mercado Pago (Access Token y filtros) en `config.html`.
- Para envío por FTP del DBF: configurar credenciales y probar conexión desde Configuración → FTP.
  - Nota: el proyecto espera FTP por el puerto 21.

## Manejo de errores

- Si hay error de `MP_ACCESS_TOKEN`, la app muestra un mensaje claro recomendando revisar Configuración → Mercado Pago.
- Errores de FTP se muestran como mensajes en la UI (Caja) y pueden registrarse en logs.
- Otros errores de red/API se reflejan en la notificación y en el log visual de Caja.

## Referencias de implementación

- Vista: `public/caja.html`
- Lógica UI Caja: `src/caja.ts` (handler del botón, renderizado de tabla y logs)
- Lado principal: `src/main.ts` (handler `generate-report`, generación de archivos, intento de envío FTP, notificaciones a la UI)
