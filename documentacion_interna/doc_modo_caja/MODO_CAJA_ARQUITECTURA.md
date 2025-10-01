## Modo Caja — Arquitectura técnica (UI + Backend)

### Alcance
- **Objetivo**: describir cómo está constituido el Modo Caja (interfaz, puente preload y backend), sus flujos manuales/automáticos y los contratos IPC.
- **Ámbito**: `public/caja.html`, `src/renderer.ts` (lógica UI), `src/preload.ts` (bridge IPC), `src/main.ts` (handlers y timers), servicios auxiliares (FTP, reportes, MP) y configuración persistida.

### Componentes y responsabilidades
- **UI (caja)**
  - Archivos: `public/caja.html` (nuevo layout con iconos Inicio/Movimientos/Facturas/Config), `src/caja.ts` (lógica dedicada a Caja).
  - Cambios UI recientes:
    - Se removieron “DESCARGAR MP”, `auto:Desactivado`, minutero y día visual.
    - Se agregaron iconos: casa (Inicio), mp (Movimientos), peso (Facturas), engranaje (Config).
    - Visor de logs con 4 líneas, `overflow-auto`, mayor protagonismo; recibe eventos de facturación, remitos y recibos.
    - Pestaña “Facturas”: selector de fecha + botón “Calcular” y tabla con columnas `Tipo|Desde|Hasta|Total` y footer “Total (FA+FB)`. Filas: `FB, FA, NCB, NCA, REC, REM`.

- **Frontend dedicado Caja** — `src/caja.ts`
  - Navegación de tabs: `selectPane('home'|'table'|'fact')`; el icono ARCA solo aparece en `home`.
  - Logs: `appendLog()` conserva 4 líneas; escucha `auto-report-notice` y `ws-health-update`.
  - Pestaña Facturas: llama `caja:get-summary` para poblar la tabla y mostrar el total (FA+FB).

- **Preload (bridge IPC)** — `src/preload.ts`
  - Expone en `window.api` los handlers usados por Caja:
    - Reportes: `generateReport()`, `exportReport()`, `sendReportEmail()`.
    - Automático: `autoStart()`, `autoStop()`, `autoStatus()`, `pauseAuto()`, `resumeAuto()`, `getAutoTimer()`.
    - Eventos: `onAutoNotice(cb)`, `onAutoTimerUpdate(cb)`.
    - Navegación: `openView('config'|'caja'|'imagen'|'galicia')`, `setWindowSize(w,h)`.
    - FTP utilitarios: `ftpStart/Stop/Status`, `ftpSendFile`, `ftpSendWhatsappFile` (para integraciones).
    - Facturación: endpoints agrupados en `window.api.facturacion.*` (para emitir y listar, ajenos a Caja pero disponibles).

- **Backend (main process)** — `src/main.ts`
  - Vista Caja: `open-view('caja')` carga `public/caja.html`, ajusta tamaño mínimo y restaura posición/estado desde `store`.
  - Handlers de reportes:
    - `ipcMain.handle('generate-report')`: ejecuta `runReportFlowAndNotify('manual')` y retorna `{ count, rows, outDir, files, ftp }`.
    - `ipcMain.handle('export-report')`: expone directorio de salida vigente.
    - `ipcMain.handle('send-report-email')`: arma adjuntos del día y dispara envío.
  - Modo automático (timer principal):
    - IPC: `auto-start`, `auto-stop`, `auto-status`, `auto-pause`, `auto-resume`, `auto-get-timer`.
    - En cada tick (si el día está habilitado): ejecuta `runReportFlowAndNotify('auto'|'remoto')` y emite:
      - `mainWindow.webContents.send('auto-report-notice', { info|error|count, rows })`.
      - `mainWindow.webContents.send('auto-timer-update', { remaining, configured })`.
  - Integraciones auxiliares:
    - FTP server opcional para puente local (autostart si configurado).
    - Watcher remoto (archivos gatillo) y flujo A13 (si existe configuración).
  - Tray y perfiles: el menú de bandeja habilita acceso directo a Caja; visibilidad condicionada por permisos de perfil activos en `store`.

### Flujos principales
- **Manual (desde UI)**
  1) `#btnCajaGenerate` → renderer llama `window.api.generateReport()`.
  2) Backend ejecuta flujo de reporte/FTP; responde a UI con conteo y filas recientes.
  3) UI renderiza “últimos 5” y muestra log “Reporte generado: N pagos”.

- **Automático (cron interno)**
  1) Usuario/Config enciende `auto-start`; el backend inicia `setInterval` (segundos desde configuración).
  2) Cada tick: valida “día habilitado”, ejecuta reporte, intenta FTP si corresponde y emite notificaciones UI.
  3) La UI muestra estado (`auto:On/Off/Pausado/Desact.(día)`) y countdown (`onAutoTimerUpdate`).

- **Eventos y observabilidad (UI)**
  - `auto-report-notice`:
    - `{ info: string }`: mensajes informativos (e.g., “FTP: enviado OK”).
    - `{ error: string }`: errores operativos (credenciales MP/FTP, red, etc.).
    - `{ count, rows }`: resumen de corrida y filas recientes (máx. 8 para UI; se renderizan 5).
  - `auto-timer-update`: `{ remaining, configured }` para el contador.

### Contratos IPC (resumen)
- UI → Backend (preload expone):
  - `generateReport(): { count, rows, outDir, files, ftp }`
  - `exportReport(): { outDir }`
  - `sendReportEmail(): { ok?: boolean }`
  - `autoStart()/autoStop()/autoStatus()/pauseAuto()/resumeAuto()/getAutoTimer()`
  - `openView(view)`

- Backend → UI (eventos):
  - `auto-report-notice` (logs de procesamiento FAC/REC/REM y obs AFIP), `auto-timer-update` (countdown), `ws-health-update` (icono ARCA).

### Configuración relevante (Store/ENV)
- Vista por defecto: `DEFAULT_VIEW` → `'caja'|'config'|'imagen'` (si falta, Caja).
- Automático:
  - `AUTO_INTERVAL_SECONDS`: intervalo del timer.
  - `AUTO_DAYS_*`: booleans por día (Sunday..Saturday) para habilitar/deshabilitar ejecución.
  - `autoPaused/autoActive`: estado interno del timer (reflejado en `autoStatus`).
- FTP local (opcional): `FTP_SRV_URL`, `FTP_SRV_USER`, `FTP_SRV_PASS`, `FTP_SRV_ROOT` (autostart si configurado).

### Errores y clasificación (ejemplos típicos)
- Config MP faltante: notifica `auto-report-notice { error: 'Comprobar la cuenta de Mercado Pago...' }`.
- Fallas de comunicación: `auto-report-notice { error: 'MP – Comunicación fallida...' }`.
- Días no habilitados: `auto-report-notice { info: 'Automático inactivo (día no habilitado)', dayDisabled: true }`.

### Persistencia del resumen “Facturas”
- Fuente de verdad: archivos `.res` generados por cada emisión/proceso.
- Ubicación persistente: `userData/fac/out/*.res` (además se consideran `processing/done`).
- Para Recibos/Remitos, el sistema agrega `IMPORTE TOTAL` al `.res` y copia una versión a `fac/out` para asegurar disponibilidad al recalcular.
- El handler `caja:get-summary` lee esos `.res` por fecha, calcula `desde/hasta/total` por tipo y retorna filas fijas + total FA+FB.

### Criterios de aceptación (QA rápido)
- Botón “Generar” produce reporte y filas recientes, sin congelar UI.
- Indicador automático refleja: On/Off/Pausado/Desactivado por día; countdown decrece y se resetea tras cada corrida.
- Eventos UI muestran logs informativos/errores oportunos.
- `open-view` mantiene y restaura posición/estado de ventana Caja.

### Roadmap sugerido (Caja)
- Export multiperfil: restringir acciones de Caja por `perfiles_config` (ya hay seed de perfiles).
- Telemetría de ejecución: guardar métricas de corridas (duración, cantidad, estado FTP) para diagnósticos.
- Retries con backoff en FTP (si falla) y reenvío manual desde UI.
- Tests UI de smoke (DOM events) para `#btnCajaGenerate`, `#autoIndicatorCaja` y render de tabla.


