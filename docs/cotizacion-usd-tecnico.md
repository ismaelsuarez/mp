## Consulta de cotización Dólar (AFIP/WSFE) — Especificación técnica y diagnóstico

### 1) Alcance y objetivo
- **Objetivo**: Consultar cotización de moneda (principalmente Dólar) en PRODUCCIÓN a través de WSFE (AFIP), sin emitir comprobantes, para visualizar en UI (Modo Caja) y para validación previa.
- **Fuentes**: AFIP/WSFEv1 (PROD). Fallback ARCA/BFEX (BFEGetCotizacion) no habilitado en este release (requiere TA SOAP del servicio BFEX).

### 2) Flujo end-to-end (UI → IPC → Servicio → WSFE)
1. UI (`public/caja.html`) dispara dos lecturas: `ULTIMA` y `HABIL_ANTERIOR`.
2. IPC main (`cotizacion:get`) invoca `afipService.consultarCotizacionMoneda` con `{ monIdText:'DOL', modo, baseDate? }`.
3. `afipService` obtiene una instancia AFIP (PROD), valida la moneda (catálogo), calcula `prevDiaHabil` según modo y llama a `FEParamGetCotizacion`.
4. Respuesta normalizada: `{ monId, monCotiz, fchCotiz, fuente:'AFIP/WSFEv1(PROD)', modo }`.
5. UI actualiza el indicador (pill) y persiste un cache local (LocalStorage) para degradar con último valor.

### 3) Contratos de integración
- IPC request: `ipcMain.handle('cotizacion:get', args?: { monIdText?: string; modo?: 'ULTIMA'|'HABIL_ANTERIOR'; baseDate?: string /*YYYYMMDD*/ })`
- IPC response OK: `{ monId: 'DOL', monCotiz: number>0, fchCotiz: 'YYYYMMDD', fuente: 'AFIP/WSFEv1(PROD)', modo: 'ULTIMA'|'HABIL_ANTERIOR' }`
- IPC response Error: `{ error: true, message: string, transient?: boolean }`

### 4) Implementación — puntos clave
- UI (`public/caja.html`)
  - Usa `window.api.facturacion.getCotizacionMoneda(args)` para invocar IPC `'cotizacion:get'`.
  - Muestra: "Dólar (AFIP) = {ULTIMA} | Hábil ant: {HABIL_ANTERIOR}" y badge de estado (ok/advertencia/sin datos).
  - Si falla, intenta mostrar el último valor cacheado en `localStorage`.

- Preload (`src/preload.ts`)
  - Expone `facturacion.getCotizacionMoneda(args)` que hace `ipcRenderer.invoke('cotizacion:get', args)`.

- IPC main (`src/main.ts`)
  - Handler:
    - Carga on-demand `afipService`.
    - Llama `afipService.consultarCotizacionMoneda(args)`.
    - Normaliza error y marca `transient` si coincide con timeout/red/5xx.

- Servicio (`src/modules/facturacion/afipService.ts`)
  - `consultarCotizacionMoneda({ monIdText='DOL', modo='ULTIMA', baseDate? })`:
    - Normaliza `monId` (PES/DOL/EUR) y valida contra `FEParamGetTiposMonedas` (cache 12h).
    - Cache en memoria (15 min) por `{ monId, modo, baseDate }`.
    - Modo:
      - `ULTIMA`: llama `getCotizacion(monId)`.
      - `HABIL_ANTERIOR`: calcula `prevDiaHabil(baseDate||hoy)` y llama `getCotizacion(monId, fch)`.
    - Devuelve `{ monId, monCotiz, fchCotiz, fuente:'AFIP/WSFEv1(PROD)', modo }`.
  - `getCotizacion(afip, monId, fch?)`:
    - Llama `afip.ElectronicBilling.getCurrencyCotization(monId, fch?)` (nomenclatura del SDK local compatible). Si el SDK expone `getCurrencyQuotation`, la capa adapter lo resuelve en otros flujos.
    - Valida valor > 0.
    - Clasifica errores: timeouts/red/5xx ⇒ `TRANSIENT_COTIZ`, resto ⇒ `PERMANENT_COTIZ`.
  - `ensureMonedasValid(afip, monId)`:
    - Obtiene catálogo `getCurrenciesTypes()` (cache 12h) y exige que `monId` esté listado.

### 5) Tiempos, cachés y tolerancias
- Cache UI (LocalStorage): conserva último valor para degradar la vista si AFIP no responde.
- Cache servicio (memoria): 15 minutos por `{ monId, modo, baseDate }`.
- Timeout explícito: el handler `cotizacion:get` no impone timeout adicional; el SDK/transport maneja su propio timeout. En flujos anteriores el timeout típico fue 6s.

### 6) Registro y observabilidad
- Consola UI: `[caja] consultando DOL (última y hábil anterior)...` y resultado.
- Back-end: logs de `afipService` (si `FACTURACION_DEBUG=true`) y errores de IPC normalizados `{ error, message, transient }`.
- Auditoría de emisión no se activa en esta consulta (no se emite FECAE).

### 7) Diagnóstico — por qué "no trae la información"
Revisar en este orden:
1. Cert/Key y TA válidos en PROD:
   - Panel Administración AFIP configurado (CUIT, Cert, Key, PV). Errores de TA/WSAA pueden impedir el uso de WSFE.
2. Catálogo de monedas:
   - `ensureMonedasValid` debe listar `DOL`. Si `MonId inválido`, revisar conectividad al catálogo o cambios en el SDK.
3. Conectividad/timeout hacia WSFE:
   - DNS/HTTP hacia `https://servicios1.afip.gov.ar/wsfev1/service.asmx`.
   - Firewalls corporativos, proxy o DPI pueden bloquear.
4. SDK de AFIP local:
   - Método `getCurrencyCotization(monId, fch?)` debe existir. Si el SDK del entorno expone `getCurrencyQuotation`, la ruta de cotización en emisión lo contempla; en consulta directa dependemos del método disponible.
5. Errores normalizados:
   - `TRANSIENT_COTIZ`: reintentar más tarde (red/timeout/5xx).
   - `PERMANENT_COTIZ`: parámetros inválidos (MonId desconocido, fecha inválida) o cambio de contrato.
6. UI/IPC:
   - Confirmar que `preload.ts` expone `getCotizacionMoneda` y que `caja.html` invoca `'cotizacion:get'` (se corrigió referencia previa a un objeto `res` inexistente en error path).

### 8) Pruebas manuales rápidas
- DevTools (Ventana Caja → Console):
  - `await window.api.facturacion.getCotizacionMoneda({ monIdText:'DOL', modo:'ULTIMA' })`
  - `await window.api.facturacion.getCotizacionMoneda({ monIdText:'DOL', modo:'HABIL_ANTERIOR' })`
  - Esperado: `{ monId:'DOL', monCotiz: >0, fchCotiz:'YYYYMMDD', fuente:'AFIP/WSFEv1(PROD)', modo }`

### 9) Consideraciones ARCA/BFEX (deshabilitado)
- Para consultar BFEGetCotizacion correctamente se requiere:
  - WSAA login para servicio **BFEX** y TA específico.
  - SOAP firmado con `PCERT.crt`/`PKEY.key` del cliente y armado de envelope (no es un GET/JSON simple).
- Estado actual: no habilitado. La UI y el servicio usan AFIP/WSFE (PROD) como fuente principal.

### 10) Posibles mejoras
- Agregar timeout explícito y reintentos en `cotizacion:get`.
- Exponer fallback a `getCurrencyQuotation` en la consulta directa (ya contemplado en emisión/adapter) si la versión del SDK lo requiere.
- Tap de auditoría opcional para esta operación, similar al de emisión, con request/response sanitizados.

### 11) Resumen
- La consulta en Caja usa **WSFE/PROD** vía `afipService.consultarCotizacionMoneda`.
- Se soportan dos modos: **última** y **día hábil anterior**.
- Caché en memoria (15m) + degradación UI con último valor local.
- Errores se clasifican: `TRANSIENT_COTIZ` (red/timeout/5xx) vs `PERMANENT_COTIZ` (parámetros/contrato).


