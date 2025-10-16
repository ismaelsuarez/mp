## Auditoría integral del módulo de Facturación (UI y .fac)

### Resumen ejecutivo (estado actual)
- Emite Factura A/B/C, Nota de Crédito A/B/C y Nota de Débito A/B/C vía WSFE (WSAA + WSFEv1) usando adapter local `CompatAfip` sobre `sdk/afip.ts-main`.
- Genera CAE/CAE_Vto y QR oficial AFIP; produce PDF y `.res` en pipeline por UI y por `.fac`.
- Soporta MiPyME (FCE) mapeando a tipos 201–213 cuando corresponde.
- Parser `.fac` detecta `ITEM:` y totales; extrae `AFECTA FACT.N:` para asociar NC/ND. Inferencia de IVA por totales cuando ítems vienen con `iva=0`.
- `CondicionIVAReceptorId` se resuelve por catálogo AFIP y se envía siempre en PROD. Reglas receptor↔tipo alineadas a MTXCA.
- Contingencia con cola SQLite: backoff, circuit breaker, clasificación de errores transitorios (incluye “AFIP sin CAE”). Idempotencia por `sha256`.

### Arquitectura & capas
```
UI (Electron) / .fac watcher
   │ IPC 'facturacion:emitir' / pipeline.fac
   ▼
FacturacionService.emitirFacturaYGenerarPdf(params)
   │  (mapea a Comprobante, set cbteTipo numérico)
   ▼
afipService.solicitarCAE(Comprobante)
   │  (FEParamGet*, consolidación IVA/totales, CondicionIVAReceptorId)
   ▼
CompatAfip.ElectronicBilling.createVoucher(FeCAEReq)
   │  (WSAA/WSFEv1 SOAP, sdk local)
   ▼
Respuesta WSFE (CAE, CAEFchVto, Obs/Err)
   │
   ├─ Persistencia/Idempotencia (DbService/IdempotencyManager)
   ├─ QR oficial (AfipHelpers.buildQrUrl)
   └─ PDF + .res + FTP (facProcessor/pipeline)
```

### 1) Resumen ejecutivo
 - Estado actual (producción):
  - WSAA/WSFEv1 operativos en `https://wsaa.afip.gov.ar/ws/services/LoginCms` y `https://servicios1.afip.gov.ar/wsfev1/service.asmx`.
  - Envío de `CondicionIVAReceptorId` habilitado en PROD. Para CF (DocTipo=99, DocNro=0) se envía 5; si hay categoría explícita (RI/MT/EX) se resuelve por catálogo de AFIP (cache 24h).
  - QR oficial AFIP incorporado (URL `https://www.afip.gob.ar/fe/qr/?p=...`).
  - PDF: fecha corregida (sin desfase) y ocultamiento de líneas de IVA en cero.
  - Pipeline `.fac` restituido: no borra `.fac` hasta enviar `.res` por FTP.
 - Cola de contingencia separada (SQLite `contingency.db`) integrada al proceso main con health-check WS y circuito (pausa/reanuda).
 - Contingencia sin `.env`: entrada fija `C:\tmp`; rutas internas bajo `app.getPath('userData')/fac` (staging/processing/done/error/out); tiempos y circuito definidos por constantes.
 - Política de cotización flexible (MonedaPolicy): fuente oficial WSFE; `CANCELA_MISMA_MONEDA=S` exige cotización exacta del día hábil anterior; `N` tolera desvíos dentro de +2% arriba y hasta −80% abajo (máx. 400% de caída). Si viene `COTIZADOL>0` y está en rango, se usa como valor fiscal (fuente=`COTIZADOL`); si no, se usa la oficial de WSFE. Se audita `{ monId, canMisMonExt, policy, monCotiz, oficial, fuente, fchOficial }`.

### 1 bis) Calibraciones recientes (Sep 2025)
- Integración AFIP / WSFE
  - Prioridad a `cbteTipo` numérico: `afipService.solicitarCAE` usa `comprobante.cbteTipo` (3/8/13 para NC A/B/C; 1/6/11 para FA/FB/FC) cuando está presente; si no, mapea desde `tipo`. Evita que NC se reporten como factura.
  - `getUltimoAutorizado(ptoVta, tipo)` acepta `number | TipoComprobante` (consistencia en callers).
  - `CbtesAsoc` enriquecido: si faltan `Cuit` y/o `CbteFch`, se completa con CUIT del emisor y `CbteFch` obtenido vía `getVoucherInfo` del comprobante asociado (cuando está disponible). Reduce observaciones y rechazos.
- Flujo `.fac` y servicio de emisión
  - `facProcessor.emitirAfipWithRetry` delega a `FacturacionService.emitirFacturaYGenerarPdf` (mismo camino que UI), unifica validaciones y armado FE.
  - NC: importes siempre positivos y `CbtesAsoc` obligatorio; se valida consistencia Tipo/Letra/PV respecto del comprobante origen.
  - Inferencia de IVA por totales: si todos los ítems traen `iva=0` pero `TOTALES` indica una única alícuota (21/10.5/27), se asigna esa alícuota a los ítems y se consolida `Iva`. Previene que se reporte como Exento (`ImpOpEx`).
  - Idempotencia: encolado por `sha256` del `.fac`; el archivo no se borra hasta `RES_OK` (tras FTP). Reintentos con backoff en transitorios.
- Contingencia y resiliencia
  - Errores transitorios: DNS/red/timeout/“en proceso”/“AFIP sin CAE” ⇒ `nack` con backoff; no mover a `error` ni borrar `.fac`.
  - Circuit breaker de WS integrado a la cola (pausa/resume automáticos según salud WS/cooldown).
- Observabilidad
  - Logs clave reforzados: `[AFIP_NO_CAE] { observaciones }`, `[afip.cae.ok]`, trazas de moneda `[FACT] FE Moneda {...}`, receptor `{ cbteTipo, condIvaCode, docTipoFE, docNroFE }`.
- Alineación MTXCA
  - Reglas receptor vs tipo reforzadas (A no admite CF; B rechaza RI). Cuando `ImpIVA=0` no se envía `Iva/AlicIva`.

### 1 ter) Calibraciones recientes (Oct 2025)
- Asociación de NC por período (fallback): para `CbteTipo` 3/8 (NC A/B), si no se detecta un `AFECTA FACT.N:` válido en el `.fac`, se envía `PeriodoAsoc` con `FchDesde=monthStart(CbteFch)` y `FchHasta=CbteFch`. Exclusividad garantizada: sólo `CbtesAsoc` o `PeriodoAsoc`.
- Número oficial AFIP: se usa el número devuelto por `createVoucher` (CbteDesde/CbteHasta) como `numero` oficial. Se eliminó el cálculo local `getLastVoucher()+1` para evitar duplicados.
- Idempotencia extra por `.res`: además del `sha256` al encolar, si al comenzar a procesar existe un `.res` con el mismo basename en `out/processing/done`, se registra `[fac.duplicate.skip]` y no se reprocesa.
- Ruteo por tipo en la cola: `ContingencyController` detecta `TIPO:` y enruta a `processFacturaFacFile(...)` (FA/FB/NCA/NCB/ND), `processFacFile(...)` (REC) o `processRemitoFacFile(...)` (REM).
- Recibos/Remitos `.res` enriquecidos: incluyen `IMPORTE TOTAL` y se copia una versión del `.res` a `userData/fac/out` para consumo del resumen diario de Caja.
- Logs hacia UI Caja: se emite `auto-report-notice` con "Procesando FAC/REC/REM …", "PDF OK …" y "RES OK …".
- Resumen diario (Caja): handler `caja:get-summary` computa, por fecha, filas `FB, FA, NCB, NCA, REC, REM` con columnas `Tipo|Desde|Hasta|Total` y un footer `Total (FA+FB)`.
- Salud WS estricta: `WSHealthService` clasifica `up|degraded|down` con reglas más estrictas (HTTP sin respuesta ⇒ `down`; respuesta parcial o lenta ⇒ `degraded`; DNS+HTTP pleno ⇒ `up`).

### 1 quater) Fix crítico: Duplicación de facturas por doble watcher (Oct 16, 2025)
**Problema identificado:** El sistema tenía **3 watchers simultáneos** observando `C:\tmp`, causando que el mismo archivo `.fac` se procesara múltiples veces, generando **dos llamadas a AFIP** con **dos CAE/números diferentes** para un solo `.fac`.

**Arquitectura problemática:**
1. **ContingencyController** (watcher principal con cola SQLite + idempotencia SHA256)
2. **legacyWatcher** (wrapper chokidar en bootstrap que llamaba a ContingencyController via adapter)
3. **facWatcher** (watcher legacy en main.ts con cola en memoria, sin idempotencia)

**Race condition:**
- Los 3 watchers detectaban el archivo estable al mismo tiempo (~1500ms)
- ContingencyController movía a staging y encolaba con SHA256
- legacyWatcher intentaba mover/encolar (posible duplicación)
- facWatcher procesaba directamente con `processFacturaFacFile` (sin staging, sin SHA256, sin check de .res)
- Timing window: ambos leían el archivo ANTES de que existiera el `.res`
- Check de duplicados fallaba porque el `.res` aún no se había generado
- Resultado: **dos emisiones AFIP → dos CAE diferentes**

**Solución implementada:**
- **Deshabilitar procesamiento de `.fac` en facWatcher** (mantener solo retenciones)
- Archivos modificados:
  - `src/main.ts` líneas 2106-2155 (`processFacQueue`): solo procesa `retencion*.txt`, ignora `.fac`
  - `src/main.ts` líneas 2183-2200 (`scanFacDirAndEnqueue`): filtra solo `retencion*.txt`
  - `src/main.ts` líneas 2227-2246 (callback watcher): ignora `.fac`, solo encola retenciones
  - `src/main.ts` línea 2253: log actualizado "solo retenciones"
- **ContingencyController** es ahora el único punto de entrada para archivos `.fac`
- Retenciones (`retencion*.txt`) siguen siendo procesadas por facWatcher (sin conflicto)

**Comentarios en código:**
```typescript
// ⚠️ SOLO procesar retenciones en esta cola
// Los archivos .fac (facturas/notas/recibos/remitos) son manejados por ContingencyController
// para evitar procesamiento duplicado que causaba emisión doble a AFIP
// (fix duplicación de facturas reportado por cliente - Oct 2025)
```

**Validación:**
- ✅ Un solo watcher procesa `.fac` (ContingencyController)
- ✅ Idempotencia por SHA256 + check de `.res` antes de procesar
- ✅ Pause/Resume desde UI Caja funciona correctamente (solo ContingencyController)
- ✅ Escaneo de pendientes al resume: `scanPendingFacs()` encola archivos en `C:\tmp`
- ✅ Retenciones siguen funcionando en facWatcher sin conflicto
- ✅ legacyWatcher sigue conectando con ContingencyController (sin duplicación porque comparte la misma instancia)

**Impacto:**
- Elimina duplicación de facturas reportada por cliente
- Mantiene toda la funcionalidad existente (retenciones, pause/resume, escaneo)
- Reduce complejidad: un solo punto de entrada para facturación AFIP
- Preserva resiliencia del sistema (cola SQLite, circuit breaker, backoff)

### 1 quinquies) Fix crítico: Clasificación incorrecta como EXENTO (Oct 2025)
**Problema identificado:** Facturas B y Notas de Crédito B se reportaban con montos clasificados como EXENTO cuando no correspondía, causando discrepancias con los reportes AFIP/ARCA. El sistema recalculaba totales desde items en lugar de usar los TOTALES parseados del `.fac`.

**Síntomas:**
- Items del `.fac` sin columna de IVA% → `iva=0` en parser
- `consolidateTotals()` trataba `iva=0` como operación exenta → `ImpOpEx = total`
- AFIP recibía: `ImpNeto=0`, `ImpIVA=0`, `ImpOpEx=[monto total]`
- Reportes ARCA mostraban "Exento" con valores indebidos (ej: total 0.40 → exento 0.40, neto 0, iva 0)
- Errores de redondeo: `ImpTotal = 0.39999999...` en lugar de `0.40` (recálculo aritmético vs valor del .fac)

**Solución implementada (commit Oct 2025):**
1. **Uso directo de TOTALES del .fac** (`facProcessor.ts` líneas 897-903, `afipService.ts` líneas 398-428):
   - Parser extrae **TODOS** los valores del bloque `TOTALES:` incluyendo `NETO 21%`, `NETO 10.5%`, `IVA 21%`, `IVA 10.5%`, `EXENTO` y **`TOTAL`**
   - Se empaqueta en `params.totales_fac` con flag `source: 'fac_parsed'` y el **total exacto** del .fac
   - `FacturacionService.emitirFacturaYGenerarPdf()` propaga `totales_fac`, `cotiza_hint` y `can_mis_mon_ext` al comprobante
   - `afipService.solicitarCAE()` detecta `totales_fac.source === 'fac_parsed'` y:
     - Usa `ImpTotal = round2(totalFac)` **directamente del .fac** (NO recalcula)
     - Usa `ImpNeto`, `ImpIVA`, `ImpOpEx` desde los valores parseados
     - Construye `Iva[]` array desde neto/iva por alícuota del .fac
     - Aplica `round2()` solo para formatear a 2 decimales (evita punto flotante)
   - Método identificable en logs: `metodo: 'fac_parsed'`

2. **Priorización de COTIZADOL del .fac** (`afipService.ts` líneas 472-498):
   - Si el `.fac` trae `COTIZADOL:` (cotiza_hint), se usa **directamente** sin consultar AFIP
   - Evita errores por falta de método `getCurrencyQuotation` en SDK local
   - Solo consulta AFIP si NO viene cotización en el .fac
   - Log: `[FACT] Usando COTIZADOL del .fac directamente: { monId, cotiz, canMis }`
   - Fuente: `'COTIZADOL'` cuando viene del .fac, `'WSFE'` cuando consulta AFIP, `'FALLBACK'` en caso de error

3. **Inferencia inteligente de alícuotas múltiples** (`facProcessor.ts` líneas 796-844):
   - Detecta cuando todos los items tienen `iva=0` pero `TOTALES` indica IVA > 0
   - **Caso única alícuota:** asigna esa alícuota a todos los items
   - **Caso múltiples alícuotas:** infiere del **nombre del producto** (ej: "PRUEBA 21" → 21%, "PRUEBA 10.5" → 10.5%)
   - **Fallback:** usa alícuota predominante por monto de neto si no detecta en nombre
   - Logs: `[FAC][PIPE] iva:inferred:name`, `[FAC][PIPE] iva:inferred:predominant`

4. **Renderizado PDF con moneda dinámica** (`pdfRenderer.ts` líneas 215-232, 797-804):
   - Nueva función `getMonedaTexto(moneda)`: mapea `'DOLARES'/'DOL'/'USD'` → `'DÓLARES'`, `'EUROS'/'EUR'` → `'EUROS'`
   - Total en letras ahora muestra: `"SON DÓLARES:"` cuando `moneda='DOLARES'`, `"SON EUROS:"` cuando `moneda='EUROS'`
   - `facProcessor` propaga `moneda` y `cotizacion` al objeto `data` del PDF (líneas 1035-1036)

5. **Logs de diagnóstico mejorados**:
   - `[FACT][TOTALES_FAC] Usando totales parseados del .fac { neto21, neto105, iva21, iva105, exento, ImpTotal }`
   - `[FACT][CONSOL_CHECK] { tipo, metodo: 'fac_parsed'|'items_consolidated', consolidado, ivaArray, ALERTA_EXENTO }`
   - `[FACT] Usando COTIZADOL del .fac directamente: { monId, cotiz, canMis }`
   - `[FACT] FE Moneda { monId, canMisMonExt, policy, monCotiz, oficial, fuente, fchOficial }`
   - `ALERTA_EXENTO: 'OK'` confirma ausencia de exento indebido; `'⚠️ HAY EXENTO (ImpOpEx > 0)'` indica problema

**Archivos modificados:**
- `src/modules/facturacion/facProcessor.ts`: añadido `total` a `totales_fac`, propagación de `moneda` al PDF + inferencia multi-alícuota
- `src/services/FacturacionService.ts`: propagación de `totales_fac`, `cotiza_hint` y `can_mis_mon_ext` al comprobante
- `src/modules/facturacion/afipService.ts`: priorización `totales_fac.total` sobre recálculo + priorización de `cotiza_hint` sobre consulta AFIP + helper `round2()`
- `src/pdfRenderer.ts`: función `getMonedaTexto()` y renderizado dinámico de moneda en total en letras

**Validación:**
- `.fac` con alícuotas mixtas (21% + 10.5%) → envía `Iva[{Id:5, BaseImp:neto21, Importe:iva21}, {Id:4, BaseImp:neto105, Importe:iva105}]`
- `ImpOpEx=0` cuando `EXENTO=0` en TOTALES del `.fac`
- `ImpTotal` usa el valor **exacto** de `TOTAL:` del .fac (sin errores de punto flotante)
- Factura en USD usa `COTIZADOL:` directamente sin consultar AFIP (evita error 10119)
- PDF muestra "SON DÓLARES: CIENTO TREINTA Y CINCO CON 52/100" cuando `MONEDA:DOLARES`
- Reportes AFIP/ARCA muestran discriminación correcta: neto gravado por alícuota, IVA correcto, exento=0

**Pruebas exitosas (02/10/2025):**
- ✅ Factura B $0.40 (CF, alícuotas 21%+10.5%) → CAE 75405346237938 | ImpOpEx=0, metodo=fac_parsed
- ✅ Factura A USD 135.52 (RI, cotiz 1423) → CAE 75405349758323 | fuente=COTIZADOL, PDF "SON DÓLARES:"

**Impacto:** 
- Resuelve discrepancias con sistema legacy; alinea a MTXCA (discriminación obligatoria de IVA para Factura B con múltiples alícuotas)
- Garantiza uso de totales exactos del .fac sin errores de redondeo
- Permite facturación en moneda extranjera sin dependencia de consultas AFIP de cotización

### 2) Alcance
- Facturación electrónica AFIP WSFEv1 (A/B) y Notas (NC/ND). MiPyME (FCE) soportada por `ModoFin` (ADC/SCA).
- Emisión por UI (Administración) y por archivo `.fac` (watcher/cola). Recibos/Remitos por `.fac` (PDF/FTP) sin AFIP.
- Auditoría no intrusiva en producción (tap opcional) y plan de pruebas con criterios de aceptación.

### 3) Arquitectura (alto nivel)
- Electron: `src/main.ts` (proceso principal), `src/preload.ts` (IPC seguro), `public/*.html` (renderer/UI).
- Capa AFIP:
  - `src/modules/facturacion/afipService.ts`: orquestación AFIP (validaciones FEParamGet*, idempotencia, resiliencia, WSFE/MiPyME, padrones A13 opcional, QR).
  - `src/modules/facturacion/adapters/CompatAfip.ts`: adapter a SDK local `afip.ts` (endpoints, createVoucher, auditoría PROD).
  - `src/services/afip/wsfe/*`: builders utilitarios (catálogo Condición IVA receptor, yyyymmdd, validaciones de montos).
- Salud y circuito WS:
  - `src/ws/WSHealthService.ts`: health-check DNS + HEAD/GET a WSAA/WSFEv1 (modo HOMO/PROD) con timeout `WS_TIMEOUT_MS`. Emite `up|degraded|down` cada `WS_HEALTH_INTERVAL_SEC`.
  - `src/ws/CircuitBreaker.ts`: estados `UP|DEGRADED|DOWN|HALF_OPEN`, umbral `WS_CIRCUIT_FAILURE_THRESHOLD`, cooldown `WS_CIRCUIT_COOLDOWN_SEC`. Persiste en `queue_settings`.
- PDF: `src/pdfRenderer.ts` + layout `src/invoiceLayout.mendoza.ts`.
- Flujo `.fac`:
  - Facturas/Notas: `src/modules/facturacion/facProcessor.ts` (parseo, normalización, emisión AFIP con reintentos, PDF, `.res`, FTP).
  - Recibos/Remitos: `facProcessor.ts` (ramas específicas; sin AFIP).
- Persistencia (emitidas/pendientes): `src/services/DbService.ts`.
- Cola de contingencia (opcional, separada): `src/services/queue/QueueDB.ts` + `src/services/queue/SqliteQueueStore.ts` (SQLite en `userData/queue/contingency.db`, PRAGMAs: foreign_keys=ON, journal_mode=WAL, synchronous=NORMAL, busy_timeout=5000, wal_autocheckpoint=1000).
  - Controlador: `src/contingency/ContingencyController.ts` (watcher chokidar, estabilidad por tamaño, encolado SHA256, consumo FIFO, integración WS/circuit).
  - Pipeline puro: `src/contingency/pipeline.ts` (parse/validate/buildRequest/generatePdf/generateRes).
  - Bridge AFIP (stub): `src/afip/AFIPBridge.ts` (interfaz + `StubAFIPBridge` para pruebas locales con `AFIP_STUB_MODE`).
  - Bridge AFIP real: `RealAFIPBridge` reutiliza `afipService.solicitarCAE`. Clasifica errores: timeout/red/HTTP≥500 ⇒ transient; validación/observaciones ⇒ permanent.

### 2 bis) Fuentes de configuración y directorios
- UI (Administración): puede exponer `FACT_FAC_WATCH`; la entrada efectiva de contingencia es fija en `C:\tmp`.
- Contingencia (Electron main, sin `.env`):
  - Entrada fija: `INCOMING_DIR = 'C:\\tmp'`.
  - Base interna: `BASE_DIR = path.join(app.getPath('userData'), 'fac')`.
  - Directorios: `STAGING_DIR`, `PROCESSING_DIR`, `DONE_DIR`, `ERROR_DIR`, `OUT_DIR` (subcarpetas de `BASE_DIR`).
  - Tiempos y circuito (constantes): `FAC_MIN_STABLE_MS=1500`, `WS_TIMEOUT_MS=12000`, `WS_RETRY_MAX=6`, `WS_BACKOFF_BASE_MS=1500`, `WS_CIRCUIT_FAILURE_THRESHOLD=5`, `WS_CIRCUIT_COOLDOWN_SEC=90`, `WS_HEALTH_INTERVAL_SEC=20`.
  - Kill-switch de borrados legacy: activado en código (fijo en `true`).
- Legacy watcher: si el sistema antiguo no está disponible, se levanta un `chokidar` propio sobre `C:\tmp` que emite `fileReady` y se adapta vía `LegacyWatcherAdapter`.

### 4) Flujo por UI (Administración)
1. Usuario completa datos (emisor, receptor, items, totales, concepto, fechas servicio si aplica).
2. IPC → `FacturacionService.emitirFacturaYGenerarPdf` → `afipService.solicitarCAE`.
3. Validaciones previas:
   - FEParamGet* (tipos, PV, moneda); opcional Padrón A13 si se solicita en la UI.
   - Idempotencia (evita duplicados) y resiliencia (reintentos con backoff, circuit breaker).
4. Emisión WSFE/MiPyME, construcción de QR oficial, generación de PDF y guardado en DB.
5. Resultado visible en UI con Observaciones/Errores (si los hubiere).

### 5) Flujo por archivo .fac
- Formato (claves relevantes):
  - `DIAHORA: dd/mm/aa HH:MM:SS <terminal>`; `TIPO: 1/6/3/8/2/7` (FA/FB/NC A/NC B/ND A/ND B).
  - `TIPODOC: 80/96/99` y `NRODOC:`; `CONDICION:` (CF/RI/MT/EX o literal), `IVARECEPTOR:` (código ARCA/AFIP). 
  - Bloques `ITEM:` y `TOTALES:` con `NETO %`, `IVA %`, `EXENTO`, `TOTAL`.
  - `OBS.CABCERA*`, `OBS.FISCAL`, `OBS.PIE` (texto libre para PDF).
 - Proceso (cola de contingencia activa):
  1) Watcher observa `C:\tmp`. Considera “estable” si no cambia tamaño en `FAC_MIN_STABLE_MS` y mueve a `STAGING_DIR`.
  2) Encola job `fac.process` con `sha256` del contenido (idempotencia). Antes de procesar, si existe un `.res` homónimo en `out/processing/done`, se salta (`[fac.duplicate.skip]`).
  3) Consumo (concurrency=1): mueve a `PROCESSING_DIR`, lee `TIPO:` y enruta a:
     - `processFacturaFacFile(...)` para FA/FB/NCA/NCB/ND.
     - `processFacFile(...)` (Recibo) para REC.
     - `processRemitoFacFile(...)` para REM.
     Todos los caminos generan PDF; facturas/notas además emiten CAE. Se envía `.res` y se realiza FTP cuando corresponde.
  4) Salidas por cola: PDF → `outLocal/outRed*`; `.res` → generado en `PROCESSING_DIR`. Para REC/REM, el `.res` incluye `IMPORTE TOTAL` y se copia a `userData/fac/out` para persistencia del resumen diario. El `.fac` se borra sólo tras `RES_OK`.
  5) Errores: transientes (red/AFIP 5xx/timeout/“en proceso”/“AFIP sin CAE”) ⇒ `nack` con backoff + `CircuitBreaker.recordFailure()`; permanentes (validación/negocio) ⇒ `.res` de error y mover a `ERROR_DIR`.
  6) Bloqueo de archivo: durante PROCESSING, el `.fac` vive en `PROCESSING_DIR`.
  6) Circuito: si `WSHealthService` emite `down` o el circuito está `DOWN`/cooldown, no se hace pop de jobs (pausa efectiva). `up` reanuda.
  7) Recibos/Remitos: sólo PDF/FTP (sin AFIP), manteniendo OBS/FISCAL/PIE.
  8) Moneda extranjera (DOL/EUR) – política flexible implementada:
     - Parser `.fac`: `MONEDA:` (PESOS/DOLARES/EUROS/USD), `CANCELA_MISMA_MONEDA:` (S/N), `COTIZADOL:` (cotización a usar).
     - Normalización: PESOS→PES; DOLARES/USD→DOL; EUROS→EUR.
     - Validación MonId: contra catálogo AFIP cacheado 12h.
     - FECAEReq: incluye `MonId`, `MonCotiz` y `CanMisMonExt` (si el SDK lo soporta).
     - Reglas (revisadas Oct 2025):
       - `PES` → `MonCotiz=1`.
       - `DOL`/`EUR` + `COTIZADOL:` presente → **PRIORIDAD 1**: usa ese valor directamente como `MonCotiz` (evita consultas AFIP innecesarias y errores por SDK sin método de cotización). Fuente: `'COTIZADOL'`.
       - `DOL`/`EUR` sin `COTIZADOL:` + `CANCELA_MISMA_MONEDA=S` → consulta cotización del día hábil anterior vía AFIP; selección exacta (sin tolerancia). Fuente: `'WSFE'`.
       - `DOL`/`EUR` sin `COTIZADOL:` + `CANCELA_MISMA_MONEDA=N` → consulta cotización vigente vía AFIP; selección tolerante (+80% arriba / -5% abajo). Fuente: `'WSFE'`.
     - Propagación de cotiza_hint:
       - `facProcessor` → `params.cotiza_hint`
       - `FacturacionService.emitirFacturaYGenerarPdf` → `comprobante.cotiza_hint`
       - `afipService.solicitarCAE` → detecta y usa directamente si `cotiza_hint > 0`
     - Validaciones y errores:
       - Transient: timeouts/red/HTTP≥500 o falla de `FEParamGetCotizacion` → reintentos + posible pausa por circuito.
       - Permanent: `MonId` inválido (ya no aplica cotización fuera de rango si viene de COTIZADOL del .fac).
     - Auditoría: `[FACT] FE Moneda { monId, canMisMonExt, policy, monCotiz, oficial, fuente, fchOficial }`.
     - PDF: muestra texto de moneda dinámico ("SON DÓLARES:" / "SON EUROS:" / "SON PESOS:") según `data.moneda`.
  9) Fallback inline secuencial (hotfix demo): si `enqueueFacFromPath(filePath)` falla o la cola está pausada, se procesa en línea con mutex global:
     - parse/validate → solicitar CAE → generar PDF (stub local) → generar `.res` → borrar `.fac` sólo tras `RES_OK`.
     - El `.res` inline se genera junto al `.fac` original (p. ej. `C:\tmp`) y no se envía por FTP en esta ruta.
     - Log: `[contingency] inline RES_OK { filePath, cae, vto, resPath }`.

```mermaid
flowchart TD
  A[Watcher FAC_INCOMING_DIR] -->|estable| B[Move → FAC_STAGING_DIR]
  B --> C[Enqueue fac.process (sha256)]
  C --> D[PARSED parseFac]
  D --> E[VALIDATED validate]
  E --> F[WAIT_WS/SENDING_WS solicitarCAE]
  F -->|CAE_OK| G[PDF_OK generatePdf]
  G --> H[RES_OK generateRes]
  H --> I[Move → FAC_DONE_DIR + ack + borrar .fac]
  F -->|AFIPError transient| R[requeue/backoff]
  F -->|AFIPError permanent| X[generateRes(err) → FAC_ERROR_DIR]
```

### 5 bis) Watcher .fac — flujos y manejo (end-to-end)
- Componentes:
  - `src/contingency/ContingencyController.ts` (watcher/cola), `src/contingency/LegacyWatcherAdapter.ts` (bridge legacy `fileReady`), `src/main/bootstrap/contingency.ts` (bootstrap), `src/main.ts` (facWatcher legacy: **solo retenciones desde Oct 16, 2025**), `src/contingency/pipeline.ts` (parse/validate/buildRequest/generatePdf/generateRes), `src/modules/facturacion/facProcessor.ts` (procesamiento directo), `src/afip/AFIPBridge.ts` (AFIP real/stub).
- Directorios y constantes (ver 2 bis):
  - Entrada fija `C:\tmp`; base `app.getPath('userData')/fac`; subcarpetas `staging/processing/done/error/out`; estabilidad `FAC_MIN_STABLE_MS=1500`; WS (`WS_TIMEOUT_MS=12000`, `WS_RETRY_MAX=6`, `WS_BACKOFF_BASE_MS=1500`); circuito (`WS_CIRCUIT_FAILURE_THRESHOLD=5`, `WS_CIRCUIT_COOLDOWN_SEC=90`, `WS_HEALTH_INTERVAL_SEC=20`).
- Disparadores del watcher:
  1) Principal (contingencia): `chokidar` en `C:\tmp` → evento `add` (archivo estable) → mover a `staging` → `enqueue fac.process` con `sha256`.
  2) Legacy (opcional): si existe emisor que emite `fileReady(filePath)`, el adapter invoca `enqueueFacFromPath(filePath)`.
  3) ~~Alterno (main)~~ **DESHABILITADO (Oct 16, 2025)**: facWatcher en main.ts ahora **solo procesa retenciones** (`retencion*.txt`). Los archivos `.fac` son ignorados para evitar procesamiento duplicado. **Causa raíz eliminada**: se reportó duplicación de facturas (dos CAE para un mismo .fac) causada por race condition entre ContingencyController y facWatcher.
- Flujo nominal por cola (worker):
  - `pop` (si circuito lo permite) → mover a `processing` → `facProcessor.processFacturaFacFile(lockPath)` → genera PDF en `outLocal/outRed*`, genera `.res` completo en `processing`, envía `.res` por FTP y borra `.res` + `.fac` → controlador mueve a `done` (si el `.fac` aún existe) → `ack`.
  - Errores: transientes (red/AFIP 5xx/timeout) ⇒ `nack` con backoff + `CircuitBreaker.recordFailure()`; permanentes (validación/negocio) ⇒ `.res` de error y mover a `error`.
  - ACK tardío: el `ack` ocurre solo después de `PDF_OK + RES_OK` y mover a `done` (sin ACK anticipado).
- Estado del circuito y rehidratación:
  - `WSHealthService`: `up|degraded|down`. Si `down`, no `pop` y log: `circuit=DOWN; queue=PAUSED`.
  - Rehidratación al iniciar: jobs en `PROCESSING` con >120s pasan a `RETRY` para evitar bloqueos.
- Fallback inline secuencial (hotfix):
  - Disparo: si `enqueueFacFromPath` falla o la cola está `paused`.
  - Pipeline inline (mutex global): parse/validate → solicitar CAE → generar PDF → generar/enviar `.res` → borrar `.fac` sólo tras `RES_OK`.
  - Log de éxito: `[contingency] inline RES_OK { filePath, cae, vto, resPath }`.
  - Errores: transientes ⇒ no borrar `.fac`; permanentes ⇒ generar `.res` de error, sin borrar `.fac`.
- Reglas de borrado (siempre):
  - Cola: se borra al mover a `done` tras `RES_OK`.
  - Inline: se borra sólo si `generateRes` fue exitoso (RES_OK). El kill‑switch legacy protege contra borrados fuera de estos caminos.
- Logs clave:
  - Arranque: configuración (rutas/tiempos). Pausa: `circuit=DOWN; queue=PAUSED`. Rehidratación: `rehydrate job → RETRY`. Moneda: `[FACT] FE Moneda {...}`. Inline OK: `[contingency] inline RES_OK {...}`.
 - Logs de arranque y pre-cola (visibilidad e investigación):
   - `[fac.detected] { filePath, size }`
   - `[fac.stable.ok] { filePath, size }`
   - `[fac.stage.ok] { from, to }`
   - `[fac.sha.ok] { filePath, sha }`
   - `[queue.enqueue.ok] { id, filePath }`
   - `[queue.enqueue.fail] { filePath, reason }`
  - `[queue.pop] { id, filePath }`, `[fac.lock.ok] { from, to }`, `[fac.parse.ok]`, `[fac.validate.ok]`, `[afip.send]`, `[AFIP_NO_CAE] { observaciones }`, `[afip.cae.ok]`, `[pdf.ok]`, `[res.ok]`, `[fac.done.ok]`, `[queue.ack]`
  - Logs de inferencia IVA y totales (fix Oct 2025):
    - `[FAC][PIPE] iva:multiple_aliquots { tipo, iva21, iva105, iva27, items_count }` – detecta múltiples alícuotas en TOTALES
    - `[FAC][PIPE] iva:inferred:name { item, iva }` – alícuota inferida del nombre del producto
    - `[FAC][PIPE] iva:inferred:predominant { item, iva }` – alícuota asignada por predominancia de monto
    - `[FAC][PIPE] iva:inferred:single { tipo, rate, method }` – alícuota única asignada a todos los items
    - `[FACT][TOTALES_FAC] Usando totales parseados del .fac { neto21, neto105, neto27, iva21, iva105, iva27, exento, ImpTotal }` – confirmación de uso directo de TOTALES del .fac (ImpTotal es el valor exacto de `TOTAL:` del .fac, no recalculado)
    - `[FACT][CONSOL_CHECK] { tipo, metodo, items_count, items_sample, original, consolidado, ivaArray, ALERTA_EXENTO }` – verificación de consolidación vs totales originales
    - `[FACT] Usando COTIZADOL del .fac directamente: { monId, cotiz, canMis }` – confirmación de uso directo de cotización del .fac sin consultar AFIP
    - `[FACT] FE Moneda { monId, canMisMonExt, policy, monCotiz, oficial, fuente, fchOficial }` – política de moneda aplicada (fuente puede ser 'COTIZADOL', 'WSFE' o 'FALLBACK')
    - `metodo: 'fac_parsed'` indica uso de TOTALES del .fac; `'items_consolidated'` indica recálculo desde items (UI)
    - `fuente: 'COTIZADOL'` indica uso directo del .fac; `'WSFE'` indica consulta AFIP exitosa; `'FALLBACK'` indica error (usa monCotiz=1)
    - `ALERTA_EXENTO: 'OK'` confirma ausencia de exento indebido; `'⚠️ HAY EXENTO (ImpOpEx > 0)'` indica clasificación incorrecta

 - Idempotencia:
   - Único entry point: cola de contingencia + fallback inline.
   - Índice único por `sha` (SQLite `uq_jobs_sha`) evita duplicados al encolar; si ya existe, se reutiliza el id.

```mermaid
flowchart TD
  A[Fallback trigger (enqueue fail o queue paused)] --> B[Cola inline (mutex global)]
  B --> C[parseFac]
  C --> D[validate]
  D --> E[solicitarCAE (AFIP)]
  E -->|CAE_OK| F[generatePdf]
  F --> G[generateRes]
  G --> H[unlink .fac (solo tras RES_OK)]
  E -->|AFIPError transient| R[Sin unlink .fac • reintentar luego]
  E -->|PermanentError| X[generateRes(err) • mantener .fac]
```

### 6) Integración AFIP (WSAA/WSFE)
- Endpoints centralizados: `src/services/afip/AfipEndpoints.ts`.
- Tickets (TA) cacheados en carpeta de datos del usuario; no se reautentica si está vigente.
- `CondicionIVAReceptorId` en PROD:
  - Si `docTipo=99 & docNro=0` → CF (5).
  - Si la UI/.fac provee categoría (RI/MT/EX/CF) → se resuelve con `FEParamGetCondicionIvaReceptor` (cache 24h).
  - Siempre se incluye en `createVoucher`. Elimina Observación 10245.
- Concepto servicio (2/3): requiere `FchServDesde/FchServHasta/FchVtoPago`.
- Validación matemática: `ImpTotal == ImpNeto + ImpIVA + ImpTrib + ImpTotConc + ImpOpEx` (2 decimales).
 - Monedas (PES/DOL/EUR): `FECAEReq` incluye siempre `MonId`/`MonCotiz` y, si el SDK lo soporta, `CanMisMonExt`. La cotización proviene de WSFE (fuente oficial) o de `COTIZADOL` (si `N` y pasa la política). Se registra `fuente`=`WSFE` o `COTIZADOL`.
 - Monedas (PES/DOL/EUR): `FECAEReq` incluye siempre `MonId`/`MonCotiz` y, si el SDK lo soporta, `CanMisMonExt`. La cotización proviene de WSFE (fuente oficial) o de `COTIZADOL` (si `N` y pasa la política). Se registra `fuente`=`WSFE` o `COTIZADOL`.
- Notas de Crédito (NC): importes siempre positivos (`ImpTotal/ImpNeto/ImpIVA/ImpTrib/ImpTotConc/ImpOpEx` y `Iva[].Importe/BaseImp`). `CbtesAsoc` debe incluir `{ Tipo, PtoVta, Nro }` y, si se dispone, `Cuit` y `CbteFch` (AAAAMMDD). Si falta el comprobante asociado, se produce `PermanentError`. El parser `.fac` extrae asociaciones desde líneas tipo `AFECTA FACT.N: B 0016-00026318` y arma `CbtesAsoc`.

### Parsers .fac
- Archivos/funciones:
  - `src/contingency/pipeline.ts` → `parseFac(filePath): FacDTO` (básico, lectura de `ITEM:` y `TOTALES:` con regex).
  - `src/modules/facturacion/facProcessor.ts` → `processFacturaFacFile(fullPath)` (parseo completo, `ITEM:`/`TOTALES:`/`OBS.*`, detección `AFECTA FACT.N:` y armado de `params`).
- Detección `ITEM:` y regex usada:
```48:61:src/contingency/pipeline.ts
  let i = lines.findIndex(l => l.trim() === 'ITEM:');
  if (i >= 0) {
    for (let k = i + 1; k < lines.length; k++) {
      const row = lines[k]; if (/^TOTALES:/.test(row)) break;
      const m1 = row.match(/^\s*(\d+)\s+(.*?)\s+([0-9.,]+)\s+(?:([0-9.,]+)%\s+)?([0-9.,]+)\s*$/);
      if (m1) { /* cantidad, desc, unit, iva?, total */ }
    }
  }
```
- Detección `AFECTA FACT.N:` y construcción preliminar:
```656:671:src/modules/facturacion/facProcessor.ts
  const assoc = ((): { Tipo: number; PtoVta: number; Nro: number } | null => {
    for (const rawLine of lines) {
      const m = String(rawLine||'').match(/AFECTA\s+FACT\.?N[:\s]*([ABC])\s*(\d{4})-(\d{8})/i);
      if (m) { /* map A→1, B→6, C→11 */ return { Tipo: tipoOrigen, PtoVta: pv, Nro: nro }; }
    }
    return null;
  })();
```

### Emisión por tipo de comprobante (builders)
- Orquestación principal: `src/modules/facturacion/afipService.ts` → `async solicitarCAE(comprobante: Comprobante): Promise<DatosAFIP>`.
  - Consolidación de totales/IVA: `AfipHelpers.consolidateTotals(comprobante.items)` y armado de request:
```399:418:src/modules/facturacion/afipService.ts
  const request: any = {
    CantReg: 1, PtoVta: ptoVta, CbteTipo: isMiPyme ? miPymeCbteTipo : tipoCbte,
    Concepto: concepto, DocTipo: docTipo, DocNro: docNro,
    CbteDesde: numero, CbteHasta: numero, CbteFch: cbteFch,
    ImpTotal: totales.ImpTotal, ImpTotConc: totales.ImpTotConc,
    ImpNeto: totales.ImpNeto, ImpOpEx: totales.ImpOpEx,
    ImpIVA: totales.ImpIVA, ImpTrib: totales.ImpTrib,
    MonId: monIdNorm, MonCotiz: monCotizNum, Iva: ivaArray,
    CanMisMonExt: canMis
  };
```
- CBTE tipo por clase/tipo (A/B/C, FACT/NC/ND): preferencia por numérico (`cbteTipo`), fallback `AfipHelpers.mapTipoCbte(tipo)`.
  - Mapeos útiles:
```24:33:src/modules/facturacion/afip/helpers.ts
  static mapCbteByClass(kind: 'FACT'|'NC'|'ND', clase: 'A'|'B'|'C'): number {
    // FACT: A=1,B=6,C=11; NC: A=3,B=8,C=13; ND: A=2,B=7,C=12
  }
```
- Adaptador WSFE: `src/modules/facturacion/adapters/CompatAfip.ts` → `ElectronicBilling.createVoucher(req)` construye `FeCAEReq` con `CondicionIVAReceptorId` y colecciones (`Iva`, `CbtesAsoc`, etc.).

### Asociación de NC/ND (estado actual)
- Construcción final de `CbtesAsoc` en `solicitarCAE`:
```533:549:src/modules/facturacion/afipService.ts
  if (([2,7,3,8,13]).includes(Number(request.CbteTipo))) {
    request.CbtesAsoc = assocInput.map(x => ({ Tipo, PtoVta, Nro, Cuit, CbteFch }))
      .filter(z => z.Tipo && z.PtoVta && z.Nro);
    if (!request.CbtesAsoc?.length) throw new Error('PermanentError: Falta comprobante asociado...');
    // Enriquecer CbteFch/Cuit vía getVoucherInfo si falta
  }
```
- Soporte de asociación por período (fallback): para NC A/B (3/8), si no se detecta un `AFECTA FACT.N:` válido en el `.fac`, el sistema arma `PeriodoAsoc` con `FchDesde = firstDay(CbteFch)` y `FchHasta = CbteFch`. Se asegura exclusividad con `CbtesAsoc` (nunca ambos). El adapter `CompatAfip` agrega `PeriodoAsoc` al `FeCAEReq` cuando está presente.

### IVA y totales
- Consolidación en helpers:
```87:131:src/modules/facturacion/afip/helpers.ts
  static consolidateTotals(items) {
    // agrupa por alícuota, arma Iva[{Id,BaseImp,Importe}], ImpNeto/ImpIVA/ImpOpEx/ImpTotal
  }
```
- Regla WSFE: si `ImpIVA=0`, no enviar `Iva/AlicIva`:
```473:479:src/modules/facturacion/afipService.ts
  const impIvaNum = Number(request.ImpIVA);
  if (!impIvaNum) delete request.Iva;
```
- Inferencia de IVA por totales en `.fac` cuando ítems vienen con `iva=0` y hay única alícuota en `TOTALES`:
```790:798:src/modules/facturacion/facProcessor.ts
  const allIvaZero = (items||[]).every(it => !Number(it?.iva||0));
  if (allIvaZero) { const only21=..., only105=..., only27=...; if (only21||only105||only27) { const rate=...; /* asigna it.iva=rate */ } }
```

### Validaciones previas al envío
- `src/modules/facturacion/afipService.ts`
  - `AfipHelpers.validateComprobante(comprobante): string[]` (fecha, pv, número, items, total).
  - `AfipValidator.validateComprobante(params)` realiza FEParamGet* y checks de catálogo.
  - `getCondicionIvaReceptorId(...)` resuelve `CondicionIVAReceptorId` (cache 24h) en `src/services/afip/wsfe/catalogs.ts`.
- Reglas receptor↔tipo (A/B/C) documentadas y validadas en flujo `.fac` y emisión.

### Errores y logs
- Clasificación y logs en `afipService.solicitarCAE` y `AFIPBridge.solicitarCAE`:
  - Transitorios: timeout/red/DNS/`AFIP sin CAE` ⇒ reintentos/backoff (cola).
  - Permanentes: validaciones/observaciones AFIP ⇒ `.res` de error.
- Logs clave durante `.fac`:
```131:139:src/contingency/ContingencyController.ts
  // [queue.pop], [fac.lock.ok], [fac.parse.ok], [fac.validate.ok], [afip.send], [AFIP_NO_CAE], [afip.cae.ok], [pdf.ok], [res.ok]
```

### Configuración / flags actuales
- Constantes de cola/WS (sin .env) en `src/main/bootstrap/contingency.ts`:
  - `INCOMING_DIR`, `FAC_MIN_STABLE_MS`, `WS_TIMEOUT_MS=12000`, `WS_RETRY_MAX=6`, `WS_BACKOFF_BASE_MS=1500`, `WS_CIRCUIT_FAILURE_THRESHOLD=5`, `WS_CIRCUIT_COOLDOWN_SEC=90`, `WS_HEALTH_INTERVAL_SEC=20`.
- UI IPC disponibles en `src/preload.ts` (`facturacion:*`).
- Catálogo Condición IVA receptor cacheado en `AppData/Tc-Mp/afip/homo/condIvaReceptor.json`.

### Listado reutilizable (para próximo sprint)
- Funciones/clases clave:
  - `src/modules/facturacion/afipService.ts` → `solicitarCAE(comprobante: Comprobante): Promise<DatosAFIP>`: Orquesta emisión WSFE.
  - `src/modules/facturacion/afipService.ts` → `getUltimoAutorizado(pv: number, tipo: TipoComprobante|number): Promise<number>`: FECompUltimoAutorizado.
  - `src/modules/facturacion/adapters/CompatAfip.ts` → `ElectronicBilling.createVoucher(req)`/`getLastVoucher(ptoVta,tipo)`.
  - `src/modules/facturacion/afip/helpers.ts` → `consolidateTotals(items)`, `buildIvaArray(items)`, `mapCbteByClass(kind,clase)`.
  - `src/services/afip/wsfe/catalogs.ts` → `getCondicionIvaReceptorId({afip,cbteTipo,receptorHint})`.
  - `src/modules/facturacion/facProcessor.ts` → `processFacturaFacFile(fullPath)` (parseo `.fac`, inferencia IVA, armado `params`).
  - `src/contingency/ContingencyController.ts` → watcher+queue/backoff.

### Fixtures y tests existentes
- Unit: `tests/pipeline.unit.spec.ts` (parse/validate/buildRequest de pipeline básico).
- E2E simplificado: `tests/contingency.e2e.spec.ts` (lote FIFO, borrado tras `RES_OK` con stub).

### Anexos (payloads y ejemplos)
- Payload FE actual (fragmento armado): ver request en `afipService.ts` líneas 399–418 (ImpNeto/ImpIVA/AlicIva/ImpOpEx/ImpTotConc/Tributos/CbtesAsoc).
- `.fac` real procesado (NC B con asociación y exento):
```1:23:src/modules/facturacion/plantilla/2509301002139_.fac
DIAHORA:30/09/25 10:02:13 yp9_
TIPO:8
CLIENTE:(000001)A CONSUMIDOR FINAL
IVARECEPTOR:5
ITEM:
     1  AFECTA FACT.N:B 0016-00026326                       3.44                   3.44
TOTALES:
NETO 21%  :        0.00
EXENTO    :        3.44
IVA 21%   :        0.00
TOTAL     :        3.44
```

### 6 ter) Condición IVA Receptor (.fac y emisión)
- Parser `.fac`: lee `IVARECEPTOR:` y valida contra catálogo mínimo {1,4,5,6,8,9,10,13,15}. Si el código no es válido → PermanentError (se genera `.res` de error y el `.fac` pasa a `error`).
- Reglas receptor vs tipo:
  - Tipo A (1/2/3): rechaza CF (5), Exento (4), Monotributo (6/13), No Alcanzado (15).
  - Tipo B (6/7/8): rechaza RI (1) → “Receptor requiere Tipo A”.
  - Exterior (8/9) y 10 (Ley 19.640): no soportados en esta versión → PermanentError.
- Normalización de documento (para FE):
  - CF (5) → fuerza `DocTipo=99`, `DocNro=0` (aunque el `.fac` traiga otra cosa).
  - No CF → exige `DocTipo=80` (CUIT) y `DocNro` válido (>0); si falta/incorrecto → PermanentError.
- Emisión AFIP:
  - El Bridge mapea `condIvaCode` → `condicion_iva_receptor` ('CF'|'RI'|'MT'|'EX') y lo pasa a `afipService`.
  - `afipService` resuelve `CondicionIVAReceptorId` por catálogo AFIP y lo incluye en el FECAE (PROD y HOMO).
- Auditoría interna: se registra `{ cbteTipo, condIvaCode, condIvaDesc, docTipoFE, docNroFE }` en logs de emisión.

### 6 quater) Guía de re-implementación rápida (CAE + CondicionIVAReceptorId)
- Objetivo: volver a dejar funcionando la solicitud de CAE con inclusión obligatoria de `CondicionIVAReceptorId` (y obtención de `CAE` y `CAEFchVto`).

- Paso 1 — Obtener el siguiente número:
  - Usar `getLastVoucher(ptoVta, cbteTipo)` y sumar 1.
  - Fuente en adapter local (proxy del SDK): ver `CompatAfip.ElectronicBilling.getLastVoucher` (usa WSFE oficial).

- Paso 2 — Construir request consolidado (FECAEReq):
  - Campos mínimos: `PtoVta`, `CbteTipo`, `Concepto`, `DocTipo`, `DocNro`, `CbteDesde/Hasta` (siguiente número), `CbteFch` (AAAAMMDD), `ImpTotal`, `ImpTotConc`, `ImpNeto`, `ImpOpEx`, `ImpIVA`, `ImpTrib`, `MonId`, `MonCotiz` y `Iva` consolidado por alícuota.
  - Si `ImpIVA` es 0, no enviar `Iva/AlicIva` (evita obs 10018).
  - Servicios (Concepto 2/3): incluir `FchServDesde/Hasta/VtoPago`.
  - Moneda extranjera: `MonId ∈ {PES,DOL,EUR}`; `MonCotiz` consultado por WSFE. Política: exacta si `S` (día hábil anterior), tolerante si `N` (+2%/-80%).

- Paso 3 — Resolver e incluir `CondicionIVAReceptorId` (obligatorio en PROD):
  - Inferir categoría del receptor ('CF'|'RI'|'MT'|'EX') desde UI/.fac o por regla CF cuando `DocTipo=99` y `DocNro=0`.
  - Consultar catálogo AFIP `FEParamGetCondicionIvaReceptor` (cache 24h) y mapear a `CondicionIVAReceptorId`.
  - Incluir `CondicionIVAReceptorId` en el detalle del `FECAEReq`.
  - Fallback mínimo: si CF (99/0) y falla el catálogo → usar 5.

- Paso 4 — Enviar a WS y obtener CAE:
  - Llamar `createVoucher(request)` del adapter local. Este arma el `FeCAEReq` manualmente garantizando que `CondicionIVAReceptorId` esté presente y retorna:
    - `CAE` y `CAEFchVto` (fecha de vencimiento del CAE).
  - Para MiPyME (FCE), usar `ElectronicBillingMiPyme.createVoucher` y agregar `ModoFin` en `Opcionales`.

- Paso 5 — Post-proceso:
  - Construir QR oficial con datos AFIP (incl. CAE) y persistir.
  - Idempotencia: marcar aprobado con `{ ptoVta, tipo, número, cae, caeVto }`.

- Reglas receptor vs tipo (recordatorio):
  - A (1/2/3): rechaza CF (5), Exento (4), MT (6/13), No Alcanzado (15).
  - B (6/7/8): rechaza RI (1).
  - Normalización doc: CF → `DocTipo=99`, `DocNro=0`; no-CF → exige `DocTipo=80` y `DocNro>0`.

- Puntos de código (referencia rápida):
  - Orquestación y armado del request + inclusión de `CondicionIVAReceptorId`: `src/modules/facturacion/afipService.ts`.
  - Resolución por catálogo (`FEParamGetCondicionIvaReceptor`): `src/services/afip/wsfe/catalogs.ts`.
  - Envío WS y garantía de `CondicionIVAReceptorId` en `FeCAEReq`: `src/modules/facturacion/adapters/CompatAfip.ts`.
  - Bridge para `.fac` (flujo de cola): `src/afip/AFIPBridge.ts`.

### 6 bis) Salud WS y Circuit Breaker
- `WSHealthService` realiza DNS + HEAD/GET a WSAA/WSFEv1 con intervalos/timeout fijados por constantes (`WS_HEALTH_INTERVAL_SEC`, `WS_TIMEOUT_MS`).
- Emite `up|degraded|down` y actualiza backoff de la cola: ‘degraded’ incrementa requeue mínimo; ‘down’ pausa (`pause()`).
- `CircuitBreaker` cuenta fallas de red/timeout (`recordFailure()`); al superar `WS_CIRCUIT_FAILURE_THRESHOLD` pasa a `DOWN` y activa cooldown `WS_CIRCUIT_COOLDOWN_SEC`. Persiste en `queue_settings`. Tras cooldown entra `HALF_OPEN` (permite 1 job): si éxito `reset()` → `UP`, si falla → `DOWN`.
 - Rehidratación al iniciar: jobs en `PROCESSING` con más de 120s pasan a `RETRY` inmediatamente (protege contra bloqueos por caída fuera de proceso).
 - Visibilidad de pausa: cuando el circuito está `DOWN`, se loguea `circuit=DOWN; queue=PAUSED` y no se hace `pop` de jobs.

### 7) PDF y representación
- Fecha sin desfase (parsing determinista desde `YYYY-MM-DD`/`YYYYMMDD`).
- Se omiten líneas de IVA por alícuota con valor `0,00`.
- CAE y Vto impresos; QR oficial generado a partir de datos de AFIP.
- Campos dinámicos OBS/FISCAL/PIE y "GRACIAS" conservados.
- **Moneda y cotización (actualizado Oct 2025)**:
  - Total en letras dinámico: `"SON PESOS:"` (default), `"SON DÓLARES:"` cuando `moneda='DOLARES'`, `"SON EUROS:"` cuando `moneda='EUROS'`
  - Helper `getMonedaTexto(moneda)` mapea variantes (`DOLARES`/`DOL`/`USD` → `'DÓLARES'`)
  - `facProcessor` propaga `moneda` y `cotizacion` desde el .fac al objeto `data` del PDF
  - Se muestra la leyenda de moneda y la cotización aplicada cuando `MonId ≠ 'PES'`

### 8) Observabilidad y auditoría
- Logs con prefijo `[FACT]` y resultados AFIP (Observaciones/Errores). 
- Arranque de contingencia: log JSON con `{ cfg:{ incoming, staging, processing, done, error, out, stableMs, wsTimeout, ... } }`.
- Auditoría PROD (no intrusiva) opcional:
  - Flags: `AFIP_PROD_AUDIT_TAP=1` y `AFIP_AUDIT_SAMPLE=<n>`.
  - Persistencia en `logs/afip/prod/audit/<timestamp-N>/` (request/response sanitizados + resumen de checks).
  - Reporte: `scripts/afip-prod-audit-report.ts` → `docs/afip-prod-audit-summary.md`.
- Cola de contingencia: `scripts/queue_inspect.ts` / `npm run queue:inspect` para validar PRAGMAs y salud del archivo.
 - Trazas de moneda: se registra `{ monId, canMisMonExt, policy, monCotiz, oficial, fuente, fchOficial }` (y, si aplica, `COTIZADOL` como hint) para verificación MTXCA.

### 9) Configuración
- AFIP: CUIT, Cert (.crt/.pem), Key (.key), Entorno=Producción, PV habilitado (WSFEv1). 
- Directorios salida:
- `config/facturas.config.json`: `{ "pv": <n>, "outLocal": "C:\\Ruta\\Ventas", "outRed1": "...", "outRed2": "...", "printerName": "..." }`.
  - `facProcessor` utiliza `outLocal/outRed*` para colocar PDF definitivo por mes: `Ventas_PV<pv>/F<YYYYMM>/<PREFIX>_<PV>-<NRO>.pdf`.
  - `.res` se genera en `processing` (junto al `.fac` bloqueado), se envía por FTP y se borra.
  - `config/recibo.config.json`: `{ "pv": <n>, "contador": <n>, "outLocal": "..." }`.
- Secretos: certificados y claves bajo almacenamiento protegido (no en `.env`).
- Cola de contingencia (.fac): base separada `app.getPath('userData')/queue/contingency.db`. Inspección por `npm run queue:inspect` (ruta, PRAGMAs, tamaño, -wal/-shm).
- Contingencia (main): sin `.env`. Constantes listadas en 2 bis. Entrada fija `C:\tmp`; subcarpetas internas en `userData/fac`.
- Stub AFIP (dev): `AFIP_STUB_MODE=ok|fail_transient|fail_permanent`.
- Kill-switch legacy: habilitado permanentemente – protege `*.fac` de borrados/renombres fuera de la cola.

Uso rápido (cola)
1) Iniciar app (main carga `bootstrapContingency`).
2) Dejar `.fac` en `C:\tmp`.
3) Ver progreso en logs y en `userData/fac/{processing,done,error,out}`. Los `.res` se generan en `out`.

### 10) Plan de pruebas (UI)
1) Factura B – CF (DocTipo=99, DocNro=0):
   - Esperado: `Resultado=A`, `CondicionIVAReceptorId=5`, QR válido, PDF sin IVA en cero, fecha correcta.
2) Factura A – RI (DocTipo=80, CUIT válido):
   - `CondicionIVAReceptorId` resuelto por catálogo (RI). Totales cierran a 2 decimales.
3) Concepto=3 (Productos+Servicios) con fechas servicio:
   - Requeridas: `FchServDesde/Hasta/VtoPago`.
4) Nota de Crédito B por factura previa:
   - Comprobante asociado (`Tipo/PtoVta/Nro`), QR y PDF consistentes.
5) MiPyME (FCE) `ModoFin=ADC`:
   - Emite vía servicio MiPyME, imprime leyenda y mantiene QR oficial.

### 11) Plan de pruebas (.fac)
1) `TIPO:6` FB CF con `IVARECEPTOR:5` y totales mínimos:
   - Esperado: “A” + `.res` enviado; PDF correcto; QR oficial.
2) `TIPO:3/8` (NC A/B) con `CbteAsoc` (en OBS o bloque dedicado si aplica):
   - Esperado: emisión y `.res` con número NC. Importes en positivo, `CbtesAsoc` presente y consistente con la factura origen (A→FA, B→FB). Si falta `CbteFch`, el sistema intenta completarlo vía `getVoucherInfo`.
3) `EXENTO`>0 y `IVA %`=0:
   - PDF oculta líneas 0, muestra Exento. Si `TOTALES` trae una única alícuota gravada (21/10.5/27) y todos los ítems tienen `iva=0`, se infiere y aplica esa alícuota para evitar clasificar como Exento.
4) Recibo y Remito: sólo PDF/FTP, sin AFIP. Verificar `.res` con `NUMERO COMPROBANTE` e `IMPORTE TOTAL` y copia en `userData/fac/out` (visibles en resumen de Caja).
 5) Moneda Dólar (DOL): `.fac` con `MONEDA:DOLARES`, `CANCELA_MISMA_MONEDA=S` y `COTIZADOL: 1400.00`.
    - Esperado: FECAE con `MonId='DOL'` y `MonCotiz` de día hábil anterior (AFIP) exacto. Si `COTIZADOL` difiere → se ignora para el valor fiscal (se puede registrar como hint).
 6) Moneda Dólar (DOL) manual del día: `.fac` con `MONEDA:DOLARES`, `CANCELA_MISMA_MONEDA=N` y `COTIZADOL: 1400.00`.
    - Esperado: si `COTIZADOL` está dentro del rango (+2%/-80% vs oficial vigente), se usa como valor fiscal (`fuente=COTIZADOL`); si no, error permanente por política de cotización.

### 12) Criterios de aceptación
- AFIP PROD: sin Observación 10245, CAE y Vto presentes, suma de montos válida, fechas servicio cuando corresponda.
- PDFs: fecha correcta, QR oficial, sin líneas de IVA en cero, totales legibles y alineados.
- `.fac`: no se borra antes del envío exitoso del `.res`; `.res` incluye PV/número/CAE/fecha.
- Auditoría (si activada): registros con `mathOk=true`, `ivaSumOk=true`, `hasCondIva=true` y `prodHostsOk=true`.
 - Cola separada: `queue:inspect` reporta `journal_mode=WAL` y `synchronous=NORMAL`; `contingency.db` existe en `userData/queue`.
 - Fallback inline: con la cola pausada/fallando, dos `.fac` en `C:\tmp` se procesan uno por uno; se obtiene CAE, se genera PDF y `.res`, y se borran los `.fac` solo tras `RES_OK`.
 - Cola operativa: el mismo comportamiento se logra por el worker de cola (sin activar el fallback inline).
 - Notas de Crédito: emite CAE incluyendo `CbtesAsoc` correcto; si falta el asociado, se genera `PermanentError` claro.
 - **Fix exento (Oct 2025)**: `.fac` con alícuotas mixtas (21% + 10.5%) sin columna IVA% en items:
   - Logs muestran `[FACT][TOTALES_FAC]` con valores parseados del .fac, incluyendo `ImpTotal` exacto (no recalculado)
   - Logs muestran `metodo: 'fac_parsed'` en `[FACT][CONSOL_CHECK]`
   - `ALERTA_EXENTO: 'OK'` (sin exento indebido)
   - `ImpOpEx=0` cuando `EXENTO=0` en TOTALES del .fac
   - `ImpTotal` es el valor **exacto** de `TOTAL:` del .fac (0.40 no 0.3999999...) gracias a `round2()` y uso directo
   - Reportes AFIP/ARCA muestran "Neto Gravado IVA 21%" y "Neto Gravado IVA 10.5%" con valores correctos (no cero)
   - "Exento" aparece como 0.00 (no el total completo)
   - "Total IVA" es la suma correcta de IVAs por alícuota (no cero)
 - **Facturación en USD (Oct 2025)**: `.fac` con `MONEDA:DOLARES` y `COTIZADOL:1423.00`:
   - Logs muestran `[FACT] Usando COTIZADOL del .fac directamente: { monId: 'DOL', cotiz: 1423 }`
   - Logs muestran `fuente: 'COTIZADOL'` en `[FACT] FE Moneda`
   - `MonCotiz=1423` (no intenta consultar AFIP, evita error 10119)
   - PDF muestra "SON DÓLARES: CIENTO TREINTA Y CINCO CON 52/100" (no "SON PESOS:")
   - CAE obtenido exitosamente sin errores de cotización

### 13) Checklist previo a release
- [ ] CUIT, Cert y Key válidos; PV habilitado WSFEv1 en PROD.
- [ ] `CondicionIVAReceptorId` activo (CF=5 si DocTipo=99/0).
- [ ] Fecha PDF verificada con día local.
- [ ] QR válido (URL AFIP decodificable y constatación verde).
- [ ] `.fac` → `.res` por FTP correcto; limpieza post-envío.
- [ ] Auditoría PROD (muestra) sin hallazgos críticos.

### 14) Riesgos y mitigaciones
- Desfase horario del sistema → Validación NTP previa; bloquear si está desfasado.
- Cambios WSDL/serializer de AFIP → Captura temprana en auditoría; fallback de catálogo cacheado.
- Múltiples sucursales/PV → PV configurable por UI y `.fac` documentado; no forzar detección automática.
- Intermitencias AFIP → Resiliencia (reintentos, circuit breaker) e idempotencia por número propuesto.
 - Backlog .fac grande → La cola separada en `contingency.db` evita crecimiento de `facturas.db`; WAL + busy_timeout mitigan contención.

### 16) Cola de contingencia (.fac) separada (implementada, no intrusiva)
- Conexión: `src/services/queue/QueueDB.ts` crea `userData/queue/contingency.db` y aplica PRAGMAs en orden: `foreign_keys=ON`, `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`, `wal_autocheckpoint=1000`.
- Adapter: `src/services/queue/SqliteQueueStore.ts` (interfaz `QueueStore`). Operaciones: `enqueue(type,payload,sha256?,delayMs?)`, `getNext(types?)` FIFO por `available_at ASC, id ASC`, `ack`, `nack(reason?,requeueDelayMs?)`, `pause/resume`, `getStats()`.
- Esquema: tablas `queue_jobs`, `queue_audit`, `queue_settings` (migración idempotente inline). Idempotencia por `sha256` opcional.
- Inspección: `scripts/queue_inspect.ts` y script npm `queue:inspect`.
- Adopción futura: enlazar en `facProcessor` para encolar `.fac` y procesar con worker secuencial. El flujo actual de emisión no fue modificado.

### Checklist de aceptación actual (manual)
- Copiar 3 `.fac` válidos a `C:\tmp`. Verificar que se procesan en orden FIFO y que cada `.fac` se borra sólo tras `RES_OK` (archivo `.res` generado).
- Simular caída AFIP/Internet (desconectar red o `AFIP_STUB_MODE=fail_transient`): observar que el sistema realiza nack con backoff, el circuito puede pasar a `DOWN` y pausar pops, y no borra `.fac` en processing.
- Subir un mismo `.fac` dos veces: verificar que sólo uno se procesa (idempotencia por sha256).
- Verificar en PDFs el QR oficial y que `ImpTotal = ImpNeto + ImpIVA + ImpTrib + ImpTotConc + ImpOpEx`.

### 17) Alineación con MTXCA (AFIP) y soporte de Dólar (DOL)
- Alineación MTXCA (WSFEv1):
  - Autenticación y endpoints: uso de WSAA/WSFEv1 oficiales; verificación de host de producción. TA cacheado y reutilizado.
  - Estructura FECAE: campos obligatorios presentes (totales, monedas, alícuotas, concept/fechas servicio cuando Concepto=2/3). Validación matemática a 2 decimales (total vs suma de componentes y suma de IVA vs ImpIVA).
  - Condición IVA del receptor: `CondicionIVAReceptorId` resuelto por catálogo AFIP y enviado tanto en HOMO como en PROD, eliminando observaciones 10245/10246. Reglas por tipo A/B/C alineadas a MTXCA.
  - Numeración y PV: uso de `PtoVta` habilitado; obtención de “último autorizado” para determinación de siguiente número cuando aplica.
  - Observabilidad/auditoría: tap opcional en PROD con request/response sanitizados y checks (hosts, math, IVA, concepto/fechas), cumpliendo buenas prácticas de trazabilidad exigidas por MTXCA.
  - Representación fiscal: QR oficial AFIP embebido en PDF y datos de CAE/CAE_Vto impresos.
- Moneda extranjera – Dólar:
  - Códigos de moneda AFIP: se soporta `MonId='DOL'` (Dólar Estadounidense) además de `PES` y `EUR`. En algunos entornos de prueba pueden verse identificadores `USD` en mocks; el código oficial para FE es `DOL`.
  - Validación de moneda: consulta a `FEParamGetTiposMonedas` y rechazo de códigos no soportados por AFIP.
  - Cotización: cuando `MonId !== 'PES'`, se consulta `FEParamGetCotizacion` para obtener `MonCotiz`; la política valida:
    - `S` (misma moneda): valor exacto del día hábil anterior (sin desviación).
    - `N` (distinta moneda): tolerancia de +2% por encima y hasta −80% por debajo del oficial (maxDownPercent=400).
    - Fuera de rango ⇒ error permanente; fallas de red/timeout ⇒ transiente con reintentos/backoff.
  - `FECAEReq` incluye `CanMisMonExt` cuando la librería lo soporta.
  - `.fac` y dólar: se aceptan entradas tipo `MONEDA:DOLARES` y `COTIZADOL: <valor>`; el flujo normaliza a `MonId='DOL'` y utiliza la cotización obtenida de AFIP. `COTIZADOL` se usa solo como hint visual si la WS falla (no reemplaza el valor fiscal).
  - Controles de aceptación (DOL): FECAE debe incluir `MonId='DOL'` y `MonCotiz = cotización vigente`; el PDF debe reflejar “Dólar” y la cotización aplicada; constatación de QR/CAE verde.

### 18) Consulta de cotización Dólar en UI (Modo Caja)
- Indicador discreto en la barra: “Dólar (AFIP) = x.xxx,xx — hh:mm”.
- Fuente principal: WSFEv1 `FEParamGetCotizacion('DOL')` con TA de `wsfe`.
- Secuencia (MTXCA pág. ~287):
  1) `FEParamGetTiposMonedas` (validar que 'DOL' exista; cache 12h)
  2) `FEParamGetCotizacion('DOL')` → { MonCotiz, FchCotiz }
  3) Si la emisión requiere “misma moneda” (S), se usa `FEParamGetCotizacion('DOL', prevDiaHabil(cbteFch))` para informar y validar
- Comportamiento de la UI:
  - Actualiza al abrir y cada 10 minutos (botón ↻ manual)
  - Estados: OK (valor vigente), Degradado (último valor cache), Sin datos (--) 
  - No bloquea la emisión; la validación fiscal ocurre en `afipService` al emitir
- Fallback (a implementar si se requiere): cliente WSAA/WSBFE + `BFEGetCotizacion('DOL')` con TA del servicio BFEX, sólo para informar cuando WSFE no responda. Actualmente deshabilitado por requisitos de TA SOAP.

### 15) Anexos
- Constatación de CAE: escanear QR o usar el sitio AFIP “Comprobantes con CAE” con CUIT/CAE/Fecha/PV/Número/Importe.
- Variables útiles:
  - `FACTURACION_DEBUG=true` (logs detallados), `AFIP_PROD_AUDIT_TAP=1`, `AFIP_AUDIT_SAMPLE=3`.
  - `AFIP_TRACE` y `AFIP_XML_PATCH` sólo para HOMO/desarrollo.


