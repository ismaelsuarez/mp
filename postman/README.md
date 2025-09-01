AFIP WSFEv1 - Postman

1) Importar archivos
- Importá `WSFEv1.postman_collection.json` y `WSFEv1.postman_environment.json` en Postman.

2) Elegir entorno
- Homologación: setear `baseUrl` a `https://wswhomo.afip.gov.ar/wsfev1/service.asmx`.
- Producción: `https://servicios1.afip.gov.ar/wsfev1/service.asmx`.

3) Obtener Token/Sign (TA)
- Usá el script del proyecto: `npm run diagnostico:afip -- --entorno=... --cuit=... --pto=... --cert=... --key=... --mem=true`.
- Copiá `Token` y `Sign` vigentes al environment de Postman; completá `cuit` y `ptoVta`.

4) Requests disponibles
- FEDummy (ServerStatus)
- FEParamGetPtosVenta
- FEParamGetTiposCbte / Concepto / Doc / Monedas
- FECompUltimoAutorizado (variables `ptoVta`, `tipoCbte`)
- FECAESolicitar (Factura C): ajustá `cbte*`, importes y fechas de servicio si `concepto=2/3`.
- FECAESolicitar (Factura C - Servicios): usa `Concepto=2` y completa `FchServDesde/Hasta/VtoPago`.
- FECAESolicitar (NC C - CbtesAsoc): setea `CbteTipo=13` y define `CbtesAsoc` (puede múltiple).
- FECAESolicitar (ND C - CbtesAsoc): setea `CbteTipo=12` y define `CbtesAsoc` (puede múltiple).

Notas
- Requiere relación “WSFEv1” otorgada al certificado y PV como “RECE (WS)”.
- El TA dura ~12h. Si falla por 401, renová Token/Sign y reintentá.

Tips
- Para Monotributo, usar `CbteTipo=11/12/13`, `DocTipo=99`, `DocNro=0`, `ImpIVA=0`.
- Formato de fecha AFIP: `yyyymmdd` (ej.: `20250101`).


