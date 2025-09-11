# Confección de Facturas desde la UI

Este documento lista y explica los datos que maneja nuestra UI para generar una factura (y variantes NC/ND), cómo se mapean internamente y qué espera AFIP (consolidado).

## 1) Datos de entrada principales (UI → IPC)
Basado en `EmitirFacturaParams` (ver `src/services/FacturacionService.ts`).

- Emisor / Empresa (metadatos para PDF y AFIP)
  - `empresa.nombre` (string)
  - `empresa.cuit` (string, CUIT emisor) → AFIP WSAA/WSFE
  - `empresa.domicilio` (string)
  - `empresa.iibb` (string, opcional)
  - `empresa.inicio` (string, opcional)
  - `logoPath` (string, opcional)

- Comprobante (núcleo)
  - `tipo_cbte` (number): 1=A, 6=B, 11=C, 3/8/13=NC A/B/C, 2/7/12=ND A/B/C
  - `pto_vta` (number): punto de venta
  - `fecha` (string, `YYYYMMDD`): fecha de emisión
  - `concepto` (number, opcional): 1=Productos, 2=Servicios, 3=Productos y Servicios
  - `mon_id` (string, opcional): `PES` por defecto; `ctz=1`

- Receptor (cliente)
  - `cuit_receptor` (string, opcional): si no se informa y es CF → DocTipo=99, DocNro=0
  - `razon_social_receptor` (string)
  - `condicion_iva_receptor` (string): `RI`, `MT`, `EX`, `CF`, etc. (impacta PDF y reglas internas)
  - `doc_tipo` (number, opcional): 80=CUIT, 96=DNI, 99=CF (si se usa este canal en lugar de `cuit_receptor`)

- Detalle (para PDF; AFIP recibe consolidados)
  - `detalle[]`: array de ítems
    - `descripcion` (string)
    - `cantidad` (number)
    - `precioUnitario` (number)
    - `alicuotaIva` (number): 21, 10.5, 27, 0, etc. (para consolidado PDF/auxiliar)

- Totales (consolidados)
  - `neto` (number)
  - `iva` (number)
  - `total` (number)

- MiPyME (opcional)
  - `modoFin` (string|undefined): `ADC` | `SCA` → mapea a FCE; usa `ElectronicBillingMiPyme`

- Servicios/Fechas (cuando `concepto` ∈ {2,3})
  - `FchServDesde`, `FchServHasta`, `FchVtoPago` (strings `YYYYMMDD`)

- Comprobantes asociados (NC/ND)
  - `comprobantesAsociados` (array): `{ tipo, ptoVta, nro }` de la factura base

- Validaciones previas
  - `validarPadron13` (boolean): consulta A13 antes de emitir cuando hay `cuit_receptor`

## 2) Transformación interna (Service)
El `FacturacionService.emitirFacturaYGenerarPdf(params)` construye un `Comprobante` interno y delega en `afipService.solicitarCAE`.

- Mapeos clave (ver `src/services/FacturacionService.ts`):
  - `tipo_cbte` → `TipoComprobante` (`A`/`B`/`C` etc.)
  - `pto_vta`, `fecha`, `empresa.*`, `cliente.*` → estructura `Comprobante`
  - `detalle[]` → sólo para PDF; AFIP recibe consolidado (`Iva[]`)
  - `totales` (`neto`, `iva`, `total`) → AFIP (`ImpNeto`, `ImpIVA`, `ImpTotal`)
  - MiPyME: si `modoFin`, se usa el servicio FCE
  - NC/ND: `comprobantesAsociados` se pasa a AFIP

- QR AFIP: se arma URL oficial con (`cuit`, `ptoVta`, `tipoCmp`, `nroCmp`, `importe`, `moneda`, `ctz`, `tipoDocRec`, `nroDocRec`, `CAE`).

- PDF: usa `invoiceLayout.mendoza` / `FacturaGenerator` y fondos en `templates/`.

## 3) Reglas/Convenciones relevantes
- Si la empresa es Monotributo (config DB: `condicion_iva`=MT/C) y el comprobante es C (11/12/13): no se discrimina IVA (ImpIVA=0, `Iva=[]`).
- Si no hay `cuit_receptor`: DocTipo=99 y DocNro=0 (CF).
- Consolidación por alícuota: `Iva[]` se arma a partir de totales por tasa (21, 10.5, 27, etc.).
- Validaciones FEParamGet* (`AfipValidator`) previas en `afipService`.
- Idempotencia y resiliencia: a cargo de `afipService` (reintentos/circuit breaker, duplicados, etc.).

## 4) Qué necesitamos para mapear `.fac` → UI/Service
- Determinar `tipo_cbte` (`TIPO` en `.fac` o etiquetas específicas como `RECIBO`).
- Receptor: `TIPODOC`, `NRODOC`, `CLIENTE`, `CONDICION` / `IVARECEPTOR` → `cuit_receptor`/`doc_tipo` + `razon_social_receptor` + `condicion_iva_receptor`.
- Totales: `NETO 21%`, `NETO 10.5%`, `EXENTO`, `IVA 21%`, `IVA 10.5%`, `TOTAL` → `neto`, `iva`, `total` y `Iva[]` internos.
- Ítems: sólo para PDF; podemos reconstruir lista a partir de las líneas válidas.
- Pto de venta y CUIT emisor: de la configuración local (no vienen en `.fac`).
- MiPyME/FCE: si en el futuro el `.fac` incluye `MODOFIN`, mapear.
- NC/ND: agregar bloque para `CbtesAsoc` (a definir con proveedor externo).

## 5) Próximo paso
- Implementar un parser `.fac` que devuelva la estructura intermedia del documento `FAC_FORMATO.md`, y un adaptador que convierta esa estructura a `EmitirFacturaParams` (para Factura A/B/C) o a datos de Recibo (solo PDF).
