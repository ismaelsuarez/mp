# Facturación – Integración AFIP / ARCA

## Fork local de afip.ts

- Se creó un fork local basado en el SDK `afip.ts` y se expone en `src/libs/afip/`.
- Importación a usar en el proyecto:

```ts
import { Afip } from '../libs/afip';
```

- Se eliminaron dependencias externas del paquete en NPM. Se mantiene soporte de servicios: WSAA, WSFEv1, Padrones (A4/A5/A10/A13) y MiPyME (FCE) extendido.

## Padrón 13 (A13)

Wrapper:

```ts
export async function consultarPadronAlcance13(cuit: number) {
  return afip.registerScopeThirteenService.getTaxpayerDetails(cuit);
}
```

Validación antes de emitir: si falla la consulta de CUIT (no existe o error), no se envía a AFIP y se registra el error.

## Factura de Crédito MiPyME (FCE / FCEM)

- Servicio agregado `src/libs/afip/services/wsfecred.ts` expuesto como `electronicBillingMiPymeService`.
- API:
  - `createVoucherMiPyme(data, modoFin: "ADC" | "SCA")` (Opcional `ModoFin` se agrega como opcional con Id 2101).
  - `getLastVoucherMiPyme(ptoVta, cbteTipo)`.
- En `afipService.ts` si el comprobante incluye `modoFin`, se mapea `CbteTipo` al correspondiente MiPyME (1→201, 6→206, 11→211, etc.) y se usa el nuevo servicio.

## Consolidación de totales (sin ítems hacia AFIP)

- Implementado `AfipHelpers.consolidateTotals(items)` que retorna solo los montos consolidados y el arreglo de alícuotas `Iva[]`.
- El request a AFIP (WSFE o FCE) contiene únicamente totales y alícuotas; los ítems no se envían a AFIP.
- Los ítems se usan solo para PDF.

## Campos opcionales

- Soportados `ImpTrib` y `ImpOpEx` en el request si corresponden; `Tributos` opcional admitido via `comprobante.tributos`.

## IVARECEPTOR

- Se mantiene el soporte para enviar `IVARECEPTOR` al request según condición IVA del receptor (mapeo ARCA).

## UI Manual (config.html / renderer.ts)

- Permite carga manual de facturas.
- Validación de Cliente con Padrón 13 antes de emitir.
- Emisión consolidada (solo totales + IVA).
- Emisión MiPyME con selección de `ModoFin` (ADC/SCA).

## PDF

- Se usa `templates/MiFondo-pagado.jpg` como fondo cuando está disponible.
- Ítems solo para impresión (no se envían a AFIP).
- Si es MiPyME, se agrega banner/etiqueta “Factura de Crédito MiPyME – Modo: ADC/SCA”.

## Ejemplos JSON (requests)

Factura común consolidada:

```json
{
  "CantReg": 1,
  "PtoVta": 1,
  "CbteTipo": 11,
  "Concepto": 1,
  "DocTipo": 80,
  "DocNro": 20300123456,
  "CbteDesde": 9208,
  "CbteHasta": 9208,
  "CbteFch": "20250101",
  "ImpTotal": 151.5,
  "ImpTotConc": 0,
  "ImpNeto": 100,
  "ImpOpEx": 0,
  "ImpIVA": 51.5,
  "ImpTrib": 0,
  "MonId": "PES",
  "MonCotiz": 1,
  "Iva": [{ "Id": 5, "BaseImp": 100, "Importe": 21 }, { "Id": 4, "BaseImp": 100, "Importe": 10.5 }]
}
```

Factura MiPyME consolidada:

```json
{
  "CantReg": 1,
  "PtoVta": 1,
  "CbteTipo": 201,
  "Concepto": 1,
  "DocTipo": 80,
  "DocNro": 20300123456,
  "CbteDesde": 15,
  "CbteHasta": 15,
  "CbteFch": "20250101",
  "ImpTotal": 121,
  "ImpTotConc": 0,
  "ImpNeto": 100,
  "ImpOpEx": 0,
  "ImpIVA": 21,
  "ImpTrib": 0,
  "MonId": "PES",
  "MonCotiz": 1,
  "Iva": [{ "Id": 5, "BaseImp": 100, "Importe": 21 }],
  "Opcionales": [{ "Id": "2101", "Valor": "ADC" }]
}
```

Factura con tributos/exenciones:

```json
{
  "CantReg": 1,
  "PtoVta": 1,
  "CbteTipo": 6,
  "Concepto": 1,
  "DocTipo": 99,
  "DocNro": 0,
  "CbteDesde": 120,
  "CbteHasta": 120,
  "CbteFch": "20250102",
  "ImpTotal": 100,
  "ImpTotConc": 0,
  "ImpNeto": 80,
  "ImpOpEx": 20,
  "ImpIVA": 16.8,
  "ImpTrib": 3.2,
  "MonId": "PES",
  "MonCotiz": 1,
  "Iva": [{ "Id": 4, "BaseImp": 80, "Importe": 8.4 }, { "Id": 5, "BaseImp": 40, "Importe": 8.4 }],
  "Tributos": [{ "Id": 99, "Desc": "Ingresos Brutos", "BaseImp": 80, "Alic": 4, "Importe": 3.2 }]
}
```

## Notas

- AFIP solo recibe montos consolidados + IVA. Los ítems son internos y se imprimen en el PDF.
- Validación Padrón 13 se ejecuta antes de enviar a AFIP; si falla, no se emite.

### 11. UI mejorada para operador (config.html / renderer.ts)

- Panel de estado visual con chips:
  - Padrón 13: muestra estado (OK/ERROR/—) y botón “Ver detalle” con la respuesta JSON completa de A13.
  - MiPyME: indica el ModoFin seleccionado (ADC/SCA) cuando aplica.
  - Listo para emitir: resumen final de aptitud para emitir según validaciones previas e ítems.
- Checklist compacto junto a “Emitir”:
  - “Revisar” pinta badges para Padrón, MiPyME, Items y Listo, con colores informativos (verde/ámbar/rojo).
- Acciones manuales previas:
  - Validar Padrón 13 (sin emitir): consulta y muestra resultado/errores.
  - Previsualizar MiPyME: muestra si corresponde FCE y el `CbteTipo` FCE resultante.
- Editor de Tributos opcionales: tabla para agregar/quitar tributos y sus valores (`Id`, `Desc`, `BaseImp`, `Alic`, `Importe`).
- Emisión consolidada: la UI arma `detalle` solo para PDF y envía al backend totales + IVA + (opcional) tributos y MiPyME.

### 12. Fork local de AFIP – dependencias y estructura

- Ubicación del fork: `src/libs/afip/` (envoltorio) y base SDK local en `sdk/afip.ts-main/`.
- Importación recomendada en servicios/adaptadores:
  ```ts
  import { Afip } from '../libs/afip';
  ```
- Dependencias utilizadas por el fork (todas ya presentes en package.json del proyecto):
  - `soap` (1.x): cliente SOAP para WSDL AFIP (usado por el SDK local). El fork añade paso del `httpsAgent` al cliente SOAP y a la descarga del WSDL.
  - `https` (nativo Node) y `crypto` (nativo Node): inyección de un `https.Agent` con opciones TLS compatibles (TLS ≥ 1.2, `SSL_OP_LEGACY_SERVER_CONNECT`, `@SECLEVEL=1`).
  - `fs`, `path` (nativos Node): copiado de WSDL locales y lectura de certificados.
- Servicios del fork expuestos por `src/libs/afip/index.ts`:
  - `electronicBillingService` (WSFEv1 normal).
  - `registerScopeThirteenService` (Padrón 13 – A13).
  - `electronicBillingMiPymeService` (FCE/WSFECRED extendido en `src/libs/afip/services/wsfecred.ts`).
- Adaptador de compatibilidad del proyecto: `src/modules/facturacion/adapters/CompatAfip.ts`.
  - Mapea métodos de alto nivel (`getLastVoucher`, `createVoucher`, `getServerStatus`) y expone además `ElectronicBillingMiPyme`.
  - Inyecta `httpsAgent` personalizado al contexto del SDK local.

### 13. Servicios/Endpoints y WSDL soportados

- Endpoints (homologación/producción) y WSDL provienen del SDK local (`sdk/afip.ts-main/src/soap/wsdl`).
- Soportados:
  - WSAA: `LoginCms` (autenticación, manejado por el SDK local).
  - WSFEv1: emisión y consulta de comprobantes (WSDL `wsfe.wsdl` y `wsfe-production.wsdl`).
  - Padrones A4/A5/A10/A13: consultas de persona (WSDL correspondientes con sufijo `-production` / test).
  - FCE (MiPyME): implementado como extensión sobre WSFEv1 (métodos `FECAESolicitar`, `FECompUltimoAutorizado`) agregando opcional `ModoFin`.

### 14. IPC expuestos hacia la UI (preload.ts / main.ts)

- `facturacion:emitir`: emisión estándar consolidada (totales + IVA + tributos opcionales + MiPyME opcional).
- `facturacion:padron13:consulta`: consulta manual a Padrón 13 (UI: “Validar Padrón 13”).
- Otros existentes: listar, abrir PDF, idempotencia, certificados, etc.

### 15. Tests añadidos (dummy/ficticios)

- `src/modules/facturacion/__tests__/padron13.test.ts`: valida que la llamada a A13 retorne estructura o capture error controlado en ausencia de WS.
- `src/modules/facturacion/__tests__/mipyme.test.ts`: construye un comprobante con `modoFin` y verifica que no reviente el armado; puede fallar por credenciales pero no rompe el build.
- `src/modules/facturacion/__tests__/facturaNormal.test.ts`: prueba de consolidación de totales/IVA por alícuota.

### 16. Mapeo MiPyME (FCE)

| Comprobante | WSFEv1 | FCE/MiPyME |
|---|---:|---:|
| Factura A/B/C | 1 / 6 / 11 | 201 / 206 / 211 |
| ND A/B/C | 2 / 7 / 12 | 202 / 207 / 212 |
| NC A/B/C | 3 / 8 / 13 | 203 / 208 / 213 |

`ModoFin` (ADC/SCA) se informa como `Opcional` con Id `2101`.

### 17. Operativa y experiencia de uso

- Antes de emitir, la UI muestra estado de Padrón 13/MiPyME y un checklist “Listo para emitir”.
- Los ítems solo determinan totales e impresión; AFIP nunca recibe líneas de productos.
- Los tributos opcionales se pueden cargar en la UI y se informan en el request (cuando corresponda).
## Facturación (Node.js + TypeScript)

### 1. Introducción

Este módulo resuelve el flujo completo de facturación electrónica AFIP y la generación del comprobante PDF:
- Emisión de comprobantes ante AFIP (WSAA + WSFEv1) y obtención del CAE/vencimiento.
- Consolidación de importes y alícuotas de IVA según ítems.
- Renderizado del comprobante sobre plantillas calibradas (PDF con fondo preimpreso o imagen de fondo).
- Inclusión del QR oficial AFIP en el PDF.


### 2. Dependencias principales

- `pdfkit`: creación del PDF, escritura de texto, imágenes y posicionamiento absoluto.
- `qrcode`: generación del QR (en buffer) para insertarlo en el PDF.
- `dayjs`: manejo y formateo de fechas (útil para payload AFIP y presentación).
- `afip.ts` (adaptador local): integración con AFIP (WSAA/WSFE) mediante el adaptador local en `sdk/afip.ts-main` (CompatAfip). Nota: el proyecto no usa `@afipsdk/afip.js` externo.
- `fs` (nativo): escritura del archivo en disco.

Dónde se usan:
- `src/pdfRenderer.ts`: importa `pdfkit`, `qrcode`, `fs` para el render y QR.
- `src/services/FacturacionService.ts`: usa `dayjs` y orquesta AFIP + PDF.
- `src/modules/facturacion/afipService.ts` o `src/services/AfipService.ts`: encapsulan llamadas a WSFEv1 por medio del adaptador AFIP local.


### 3. Recursos externos

- Certificados AFIP (`.crt`, `.key`): utilizados por WSAA (autenticación) para firmar y obtener el Ticket de Acceso (TA). Se referencian por ruta en la configuración (no deben guardarse en el repositorio). Homologación y Producción usan pares distintos.
- Plantillas gráficas (por ejemplo `templates/MiFondo.jpg`, `templates/MiFondo-pagado.jpg`): imagen de fondo aplicada a página completa en el PDF.
- Layout (`src/invoiceLayout.mendoza.ts`): define coordenadas (en mm) para ubicar campos (cliente, fecha, totales, CAE, QR, etc.) sobre el fondo. Se referencia como `Config` en `pdfRenderer.ts`.
- QR obligatorio AFIP: se genera y coloca en el PDF. El contenido mínimo incluye CUIT emisor, tipo de comprobante, punto de venta, número, CAE y vencimiento; para verificación pública AFIP se utiliza la URL oficial base con payload base64.
- Servidores AFIP: ambientes de Homologación y Producción, con endpoints y certificados propios.


### 4. Arquitectura interna del módulo

Archivos principales:
- `src/modules/facturacion/afipService.ts` (o `src/services/AfipService.ts` en versiones previas):
  - Autenticación/instanciación del cliente AFIP (WSAA) mediante el adaptador local.
  - Emisión en WSFEv1: consulta de último comprobante, armado del payload y solicitud de CAE.
- `src/services/FacturacionService.ts`:
  - Orquestación de emisión: valida, invoca a AFIP, construye QR y genera PDF; persiste resultados si corresponde.
- `src/pdfRenderer.ts`:
  - `generateInvoicePdf`: render PDF final sobre la plantilla y coordenadas.
  - `generateCalibrationPdf`: modo calibración (dibuja rectángulos/labels en cada coordenada para ajustar el layout).
  - Incluye utilidades: `mm` para conversión mm→pt, `numeroALetras`, formateo numérico, helpers de dibujo.
- `src/invoiceLayout.mendoza.ts`:
  - Implementa `Config` (posiciones y tamaños de cada campo), incluyendo sub-totales por alícuota, totales, CAE y QR.

Funciones principales y responsabilidades:
- `autenticarAFIP` / `obtenerTicketAcceso` (encapsuladas en el adaptador/servicio AFIP): manejo WSAA y TA. La instanciación del cliente AFIP efectúa esta autenticación.
- `crearComprobante` (WSFEv1): solicita CAE construyendo el payload con totales y detalle consolidado.
- `generarFacturaConsolidada`: cálculo de netos por alícuota y sumatoria de IVA/total a partir de ítems.
- `generateInvoicePdf` (en `pdfRenderer.ts`): dibuja datos en posiciones definidas por `Config`, inserta QR y CAE.
- `generateCalibrationPdf` (en `pdfRenderer.ts`): genera una grilla con etiquetas para calibrar posiciones.

Orquestación (alto nivel): `FacturacionService.emitirFacturaYGenerarPdf` → solicita CAE a `AfipService` → construye URL/Buffer de QR oficial → llama a `FacturaGenerator`/`pdfRenderer.generateInvoicePdf` con layout configurado → retorna ruta del PDF y metadatos (Nº, CAE, vencimiento).


### 5. Flujo de emisión

1) Recepción de datos: formulario UI envía `cliente`, `ítems`, `totales` (neto, IVA, total), tipo de comprobante, `pto_vta`, fecha, etc.
2) Consolidación de importes por alícuota: se agrupan ítems por tasa (21, 10.5, 27) para calcular `BaseImp` y `Importe` de IVA de cada grupo.
3) Llamado al WSFEv1 de AFIP: se obtiene el número siguiente (GetLastVoucher), se arma `createVoucher` y AFIP devuelve `CAE` y su vencimiento.
4) Generación del QR oficial AFIP: se construye payload (ver sección Interacciones) y se obtiene la URL o el buffer del QR a insertar.
5) Render PDF con plantilla calibrada: `generateInvoicePdf` escribe datos en coordenadas del layout y coloca CAE/QR.
6) Guardado/envío: se guarda el PDF en disco y, opcionalmente, se abre o envía por el canal requerido.


### 6. Tipos de comprobantes soportados

- Facturas: A, B, C.
- Notas: Nota de Crédito (NC), Nota de Débito (ND).
- Remito: documento comercial sin intervención de AFIP (no tiene CAE). El layout y flujo de PDF son similares pero sin paso WSFEv1.

Parametrización de tipo de comprobante (`CbteTipo`):
- Mapeo interno → código AFIP (por ejemplo: A=1, B=6, C=11, NC A=3, NC B=8, NC C=13, etc.). El servicio AFIP realiza el `mapTipoCbte` según entradas de UI.


### 7. Interacciones con AFIP

Servicios web usados:
- `WSAA`: autenticación para obtener Ticket de Acceso (TA) usando el `.crt` y `.key` del emisor.
- `WSFEv1`: emisión/consulta de comprobantes electrónicos.

Requests/Responses relevantes (simplificado):
- `getLastVoucher(PtoVta, CbteTipo)` → número último autorizado.
- `createVoucher({ CantReg, PtoVta, CbteTipo, Concepto, DocTipo, DocNro, CbteDesde, CbteHasta, CbteFch, ImpTotal, ImpNeto, ImpIVA, ... , Iva:[{ Id, BaseImp, Importe }, ...] })` → `{ CAE, CAEFchVto }`.

Validaciones típicas:
- Punto de venta válido y habilitado para el CUIT.
- Secuencia de numeración (último + 1).
- Fecha de emisión en rango aceptado por AFIP.
- Totales consistentes: `ImpTotal = ImpNeto + ImpIVA + ...`.

QR AFIP oficial (verificación pública):
- Base: `https://www.afip.gob.ar/fe/qr/?p=<base64(JSON)>`.
- Payload mínimo: `{ ver, fecha, cuit, ptoVta, tipoCmp, nroCmp, importe, moneda, ctz, tipoDocRec, nroDocRec, tipoCodAut:'E', codAut: CAE }`.


### 8. Seguridad

- Protección de certificados: rutas a `.crt` y `.key` se configuran fuera del repo. No almacenar secretos en `.env` sin protección; utilizar almacenes seguros administrados.
- TLS y errores comunes: en entornos antiguos puede aparecer `dh key too small`. Solución: fortalecer parámetros de OpenSSL/Node o actualizar librerías del adaptador AFIP que negocian ciphers; en general, usar versiones recientes de Node y dependencias.
- Ambientes: Homologación y Producción tienen certificados, endpoints y CUIT/pto de venta separados. Verificar `production`/modo en la instanciación del cliente AFIP.


### 9. Diagrama (flujo simplificado)

```
Usuario → Sistema (UI) → Servicio de Facturación → Servicio AFIP → Servicio de Facturación → PDF Final
```

Detalle:
```
[Usuario] --solicita emitir--> [UI]
[UI] --IPC/HTTP--> [FacturacionService]
[FacturacionService] --WSAA/WSFE--> [AFIP]
[AFIP] --CAE+venc--> [FacturacionService]
[FacturacionService] --genera QR+PDF--> [Sistema de Archivos]
```


### 10. Próximos pasos

- Logging unificado (correlación por número de comprobante, niveles por módulo y traza de errores AFIP).
- Tests unitarios: helpers de consolidación IVA, mapeo de tipos de comprobantes y generación de QR.
- Multi-sucursal/multi-punto de venta: parametrización por perfil/tenant con aislamiento de certificados.
- Estrategias de resiliencia: reintentos controlados en WSFEv1, colas de reenvío ante caída de red.
- Validaciones previas (FEParamGet*) cacheadas para mejorar latencia y robustez.


### Apéndice: referencias de archivos clave

- `src/services/FacturacionService.ts`: orquesta emisión, construye QR y delega PDF.
- `src/modules/facturacion/afipService.ts` (y/o `src/services/AfipService.ts`): integración WSAA/WSFE.
- `src/pdfRenderer.ts`: `generateInvoicePdf`, `generateCalibrationPdf`, utilidades de render.
- `src/invoiceLayout.mendoza.ts`: layout de coordenadas y validaciones del template.


