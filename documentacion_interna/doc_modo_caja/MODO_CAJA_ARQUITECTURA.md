## Modo Caja — Arquitectura técnica (UI + Backend)

### Alcance
- **Objetivo**: describir cómo está constituido el Modo Caja (interfaz, puente preload y backend), sus flujos manuales/automáticos y los contratos IPC.
- **Ámbito**: `public/caja.html`, `src/renderer.ts` (lógica UI), `src/preload.ts` (bridge IPC), `src/main.ts` (handlers y timers), servicios auxiliares (FTP, reportes, MP) y configuración persistida.

### Componentes y responsabilidades
- **UI (caja)**
  - Archivos: `public/caja.html` (nuevo layout con iconos Inicio/Movimientos/Facturas/Config), `src/caja.ts` (lógica dedicada a Caja).
  - Cambios UI recientes:
    - Se removieron "DESCARGAR MP", `auto:Desactivado`, minutero y día visual.
    - Se agregaron iconos: casa (Inicio), mp (Movimientos), peso (Facturas), engranaje (Config).
    - **Visor de logs mejorado (Oct 2025)**:
      - Altura: 192px (h-48, antes 112px)
      - Capacidad: 50 líneas en memoria (antes 4)
      - Scrollbar personalizado: 8px, gris visible, smooth scroll
      - Auto-scroll al final cuando se agregan nuevas líneas
      - Estilo: fondo negro, fuente monoespaciada, timestamps `[HH:MM:SS]`
    - **Pestaña "Facturas" - Sistema de tablas colapsables (Oct 2025)**:
      - Selector de fecha + botón "Calcular" + total general arriba
      - **Dos tablas separadas** por moneda (plegadas por defecto):
        - **Tabla PESOS**: FB, FA, NCB, NCA, REC, REM (columnas: Tipo|Desde|Hasta|Total)
        - **Tabla DÓLARES 💵**: FA, FB, NCA, NCB (sin la "D" en visualización)
      - Headers clickeables: `▶/▼ Facturas en PESOS (N comp. - Total: X.XX)`
      - Total general: `Total (FA+FB): X.XX | USD: Y.YY` (separados por moneda)
      - REM no muestra total (sistema legacy no suma remitos)

- **Frontend dedicado Caja** — `src/caja.ts`
  - Navegación de tabs: `selectPane('home'|'table'|'fact')`; el icono ARCA solo aparece en `home`.
  - **Logs mejorados (Oct 2025)**: `appendLog()` conserva **50 líneas** con scroll automático; escucha `auto-report-notice` y `ws-health-update`.
  - **Pestaña Facturas (Oct 2025)**:
    - Llama `caja:get-summary` que retorna `{ rows, totalGeneral, totalGeneralUSD }`.
    - Separa filas por moneda: `tiposPesos=['FB','FA','NCB','NCA','REC','REM']` y `tiposDolar=['FBD','FAD','NCBD','NCAD']`.
    - Renderiza dos tablas colapsables independientes con toggle `▶/▼`.
    - Headers informativos: cuenta comprobantes con datos y muestra total parcial por moneda.
    - Total general arriba: `Total (FA+FB): X.XX | USD: Y.YY` (solo suma facturas, excluye NC/REC/REM).

- **Preload (bridge IPC)** — `src/preload.ts`
  - Expone en `window.api` los handlers usados por Caja:
    - Reportes: `generateReport()`, `exportReport()`, `sendReportEmail()`.
    - Automático: `autoStart()`, `autoStop()`, `autoStatus()`, `pauseAuto()`, `resumeAuto()`, `getAutoTimer()`.
    - Eventos: `onAutoNotice(cb)`, `onAutoTimerUpdate(cb)`.
    - Navegación: `openView('config'|'caja'|'imagen'|'galicia')`, `setWindowSize(w,h)`.
    - **Caja (Oct 2025)**: `caja.getSummary(fechaIso)`, `caja.cleanupRes(options)`, `caja.openDir(kind)`.
    - FTP utilitarios: `ftpStart/Stop/Status`, `ftpSendFile`, `ftpSendWhatsappFile` (para integraciones).
    - Facturación: endpoints agrupados en `window.api.facturacion.*` (para emitir y listar, ajenos a Caja pero disponibles).

- **Backend (main process)** — `src/main.ts`
  - Vista Caja: `open-view('caja')` carga `public/caja.html`, ajusta tamaño mínimo y restaura posición/estado desde `store`.
  - Handlers de reportes:
    - `ipcMain.handle('generate-report')`: ejecuta `runReportFlowAndNotify('manual')` y retorna `{ count, rows, outDir, files, ftp }`.
    - `ipcMain.handle('export-report')`: expone directorio de salida vigente.
    - `ipcMain.handle('send-report-email')`: arma adjuntos del día y dispara envío.
  - **Handlers Caja (Oct 2025)**:
    - `ipcMain.handle('caja:get-summary', { fechaIso })`: escanea `.res` de `out/`, `done/`, `processing/` por fecha; detecta tipo (TIPO:) y moneda (MONEDA:DOLARES); agrupa por tipo, calcula desde/hasta/total; retorna `{ rows, totalGeneral, totalGeneralUSD }`.
    - `ipcMain.handle('caja:cleanup-res', { daysToKeep?, dryRun? })`: importa dinámicamente `scripts/cleanup-res.ts` y ejecuta limpieza de `.res` > N días de `done/` y `out/`; retorna `{ ok, deleted, totalSize, files }`.
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

### Contratos IPC (resumen actualizado Oct 2025)
- UI → Backend (preload expone):
  - **Reportes MP**: `generateReport(): { count, rows, outDir, files, ftp }`, `exportReport(): { outDir }`, `sendReportEmail(): { ok?: boolean }`
  - **Modo automático**: `autoStart()`, `autoStop()`, `autoStatus()`, `pauseAuto()`, `resumeAuto()`, `getAutoTimer()`
  - **Navegación**: `openView(view)`
  - **Resumen diario (Oct 2025)**: `caja.getSummary(fechaIso): { ok, rows: Array<{tipo, desde, hasta, total}>, totalGeneral, totalGeneralUSD }`
  - **Limpieza .res (Oct 2025)**: `caja.cleanupRes({ daysToKeep?: number, dryRun?: boolean }): { ok, deleted, totalSize, files, error? }`

- Backend → UI (eventos):
  - `auto-report-notice`: logs de procesamiento FAC/REC/REM y obs AFIP (`{ info?, error?, count?, rows?, dayDisabled? }`)
  - `auto-timer-update`: countdown del modo automático (`{ remaining, configured }`)
  - `ws-health-update`: estado de WSAA/WSFEv1 para icono ARCA (`{ status: 'up'|'degraded'|'down' }`)

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

### Persistencia del resumen "Facturas" (actualizado Oct 2025)
- **Fuente de verdad**: archivos `.res` generados por cada emisión/proceso.
- **Ubicación**: `userData/fac/out/*.res`, `userData/fac/done/*.res`, `userData/fac/processing/*.res` (3 carpetas escaneadas).
- **Detección de tipo (prioridad)**:
  1. Campo `TIPO:` del .res (6=FB, 1=FA, 3=NCA, 8=NCB) — más confiable
  2. Campo `ARCHIVO PDF:` (ej: `FA_0016-00009389.pdf`)
  3. Nombre del archivo (ej: `FA_0016-00009389.res`)
  4. Contenido textual (regex, menos confiable)
- **Detección de moneda (Oct 2025)**:
  - Busca `MONEDA:DOLARES` o `MONEDA:DOL` en el contenido del .res
  - Si es dólar: convierte `FA→FAD`, `FB→FBD`, `NCA→NCAD`, `NCB→NCBD`
  - Permite separar totales en pesos vs dólares
- **Cálculo por tipo**:
  - `desde`: número más bajo del día (min)
  - `hasta`: número más alto del día (max)
  - `total`: suma de todos los `IMPORTE TOTAL:` del día
- **Handler `caja:get-summary`**:
  - Lee `.res` filtrados por fecha (`YYYYMMDD` o `DD/MM/YY`)
  - Retorna: `{ rows: [FB,FA,FBD,FAD,NCB,NCA,NCBD,NCAD,REC,REM], totalGeneral, totalGeneralUSD }`
  - `totalGeneral`: solo FB+FA (pesos)
  - `totalGeneralUSD`: solo FBD+FAD (dólares)
- **Limpieza automática (Oct 2025)**: Script `cleanup-res.ts` ejecutable vía IPC `caja:cleanup-res` para borrar .res > 60 días de `done/` y `out/` (mantiene `processing/` intacto).

### Criterios de aceptación (QA rápido - actualizado Oct 2025)
- **Reportes MP**: Botón "Generar" produce reporte y filas recientes, sin congelar UI.
- **Modo automático**: Indicador refleja On/Off/Pausado/Desactivado por día; countdown decrece y se resetea tras cada corrida.
- **Logs**: Visor muestra hasta 50 líneas con scroll suave y scrollbar visible; auto-scroll al final en nuevas entradas.
- **Resumen diario**:
  - Selector de fecha + botón "Calcular" retorna datos en < 2s.
  - Tablas colapsables (PESOS/DÓLARES) se expanden/contraen con click.
  - Headers muestran count y total correcto por moneda.
  - Total general arriba: `Total (FA+FB): X.XX | USD: Y.YY` (separados, solo facturas).
  - REM sin total, tipos correctos (FB/FA no confundidos con REM).
- **Limpieza .res**: Ejecutable manual sin errores; logs muestran archivos eliminados y espacio liberado.
- **Ventana**: `open-view` mantiene y restaura posición/estado de ventana Caja.

### Roadmap sugerido (Caja)
- **✅ Completado Oct 2025**:
  - ✅ Logs con scroll mejorado (50 líneas, scrollbar visible, smooth scroll)
  - ✅ Resumen diario con tablas colapsables (PESOS/DÓLARES separadas)
  - ✅ Detección robusta de tipos en .res (prioridad campo TIPO:)
  - ✅ Separación de monedas (FAD/FBD vs FA/FB)
  - ✅ Limpieza automática de .res antiguos (>60 días)
- **Pendiente**:
  - Botón UI para limpieza de .res (actualmente solo CLI/IPC)
  - Export multiperfil: restringir acciones de Caja por `perfiles_config` (seed ya existe)
  - Telemetría de ejecución: guardar métricas de corridas (duración, cantidad, estado FTP) para diagnósticos
  - Retries con backoff en FTP (si falla) y reenvío manual desde UI
  - Programar limpieza .res semanal automática (cron interno)
  - Exportar resumen diario a Excel/CSV desde UI
  - Tests UI de smoke (DOM events) para `#btnCajaGenerate`, tablas colapsables y render de resumen


