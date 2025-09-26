## Auditoría integral del módulo de Facturación (UI y .fac)

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
  1) Watcher (`ContingencyController.start`) observa `C:\tmp`. Considera “estable” si no cambia tamaño en `FAC_MIN_STABLE_MS` y mueve a `STAGING_DIR`.
  2) Encola job `fac.process` con `sha256` del contenido (idempotencia). FIFO por `available_at ASC, id ASC`.
  3) Consumo (concurrency=1) y estados: PARSED (`pipeline.parseFac`) → VALIDATED (`pipeline.validate`) → WAIT_WS/SENDING_WS (`RealAFIPBridge.solicitarCAE`) → CAE_OK → PDF_OK (`pipeline.generatePdf`) → RES_OK (`pipeline.generateRes`) → DONE (mueve `.fac` a `DONE_DIR` y ack).
  4) Errores: `AFIPError.kind='transient'` → nack con backoff y `CircuitBreaker.recordFailure()`; `kind='permanent'` → genera `.res` de error y mueve a `ERROR_DIR`.
  5) Bloqueo de archivo: durante PROCESSING, el `.fac` vive en `PROCESSING_DIR`. Sólo se borra tras `RES_OK`.
  6) Circuito: si `WSHealthService` emite `down` o el circuito está `DOWN`/cooldown, no se hace pop de jobs (pausa efectiva). `up` reanuda.
  7) Recibos/Remitos: sólo PDF/FTP (sin AFIP), manteniendo OBS/FISCAL/PIE.
  8) Moneda extranjera (DOL/EUR) – política flexible implementada:
     - Parser `.fac`: `MONEDA:` (PESOS/DOLARES/EUROS/USD), `CANCELA_MISMA_MONEDA:` (S/N), `COTIZADOL:` (hint solo visual).
     - Normalización: PESOS→PES; DOLARES/USD→DOL; EUROS→EUR.
     - Validación MonId: contra catálogo AFIP cacheado 12h.
     - FECAEReq: incluye `MonId`, `MonCotiz` y `CanMisMonExt` (si el SDK lo soporta).
     - Reglas:
       - `PES` → `MonCotiz=1`.
       - `DOL`/`EUR` + `CANCELA_MISMA_MONEDA=S` → cotización del día hábil anterior (prevDiaHabil de la fecha del comprobante); selección exacta (sin tolerancia).
       - `DOL`/`EUR` + `CANCELA_MISMA_MONEDA=N` → cotización vigente; selección tolerante dentro de +2% arriba y hasta −80% abajo respecto del oficial. Si viene `COTIZADOL>0` y está en rango de la política, se usa `COTIZADOL` como valor fiscal; si no, se usa la oficial WSFE.
     - Validaciones y errores:
       - Transient: timeouts/red/HTTP≥500 o falla de `FEParamGetCotizacion` → reintentos + posible pausa por circuito.
       - Permanent: `MonId` inválido, `MonCotiz` fuera de rango permitido (incluye `COTIZADOL` fuera de rango), o mismatch exacto cuando `S`.
     - Auditoría: `[FACT] FE Moneda { monId, canMisMonExt, policy, monCotiz, oficial, fuente, fchOficial }`.
     - Hint: si `N` y `COTIZADOL` fue usado como fiscal, la `fuente` será `COTIZADOL`. Si no fue usado, se registra como hint visual/log.

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

### 6 bis) Salud WS y Circuit Breaker
- `WSHealthService` realiza DNS + HEAD/GET a WSAA/WSFEv1 con intervalos/timeout fijados por constantes (`WS_HEALTH_INTERVAL_SEC`, `WS_TIMEOUT_MS`).
- Emite `up|degraded|down` y actualiza backoff de la cola: ‘degraded’ incrementa requeue mínimo; ‘down’ pausa (`pause()`).
- `CircuitBreaker` cuenta fallas de red/timeout (`recordFailure()`); al superar `WS_CIRCUIT_FAILURE_THRESHOLD` pasa a `DOWN` y activa cooldown `WS_CIRCUIT_COOLDOWN_SEC`. Persiste en `queue_settings`. Tras cooldown entra `HALF_OPEN` (permite 1 job): si éxito `reset()` → `UP`, si falla → `DOWN`.

### 7) PDF y representación
- Fecha sin desfase (parsing determinista desde `YYYY-MM-DD`/`YYYYMMDD`).
- Se omiten líneas de IVA por alícuota con valor `0,00`.
- CAE y Vto impresos; QR oficial generado a partir de datos de AFIP.
- Campos dinámicos OBS/FISCAL/PIE y “GRACIAS” conservados.
 - Moneda y cotización: si `MonId ≠ 'PES'` (ej.: `DOL`), se muestra la leyenda de moneda y la cotización aplicada (vigente o día hábil anterior según `CANCELA_MISMA_MONEDA`).

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
   - Esperado: emisión y `.res` con número NC.
3) `EXENTO`>0 y `IVA %`=0:
   - PDF oculta líneas 0, muestra Exento.
4) Recibo y Remito: sólo PDF/FTP, sin AFIP.
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


