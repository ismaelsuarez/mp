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


