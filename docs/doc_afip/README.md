# Facturación electrónica AFIP – Módulo (en construcción)

Este módulo incorpora la emisión de comprobantes electrónicos con AFIP dentro de la app (Electron). Está diseñado para funcionar 100% embebido (sin MySQL/SQLite externos) y con modo offline (comprobantes provisorios) que luego pueden validarse y obtener CAE.

## Objetivos
- Emitir Factura A/B, Nota de Crédito y Recibo.
- Generar PDF con logo/membrete y QR AFIP desde plantillas HTML (Handlebars + Puppeteer).
- Guardar historial y configuración en base local (SQLite con `better-sqlite3`, con fallback JSON si no está disponible).
- Integración con Modo Caja (emisión) y Modo Administración (configuración + historial).

## Estructura
- Código
  - `src/modules/facturacion/`
    - `types.ts`: Tipos (Emisor, Receptor, Item, Comprobante, DatosAFIP, FacturaData).
    - `afipService.ts`: Solicitud de CAE a AFIP (`solicitarCAE`).
    - `facturaGenerator.ts`: Render Handlebars + Puppeteer a PDF.
    - `templates/`: Plantillas `factura_a.html`, `factura_b.html`, `nota_credito.html`, `recibo.html`.
- Servicios/DB
  - `src/services/DbService.ts`: Tablas de configuración y comprobantes, utilidades.
  - `src/services/FacturacionService.ts`: Orquestación (CAE + QR + PDF + guardado).
- UI/Admin
  - `public/config.html` → panel “Facturación (AFIP) (en construcción)”.
  - `src/renderer.ts` → carga/guardado de empresa, parámetros e historial PDF.

## Dependencias
- `better-sqlite3` (embebido), `handlebars`, `puppeteer`, `qrcode`.
- SDK AFIP: `afip.js` (carga diferida). Si no está, la app no crashea, pero no se podrá emitir CAE hasta instalarlo.

## Bases y almacenamiento
- SQLite en: `app.getPath('userData')/facturas.db`.
- Tablas principales:
  - `configuracion_afip(cuit, pto_vta, cert_path, key_path, entorno)`
  - `empresa_config(razon_social, cuit, domicilio, condicion_iva, logo_path)`
  - `parametros_facturacion(tipo_defecto, pto_vta, numeracion)`
  - `facturas_afip(..., cae, cae_vencimiento, qr_url, pdf_path)`
  - `facturas_estado(numero, pto_vta, tipo_cbte, estado, error_msg, payload)`

## Flujo de emisión (resumen)
1. Caja confirma venta → se construye `Comprobante` + datos Emisor/Receptor/Items.
2. Se solicita CAE a AFIP (si online). Si falla, se guarda “pendiente” para reintentar.
3. Se construye URL para QR AFIP y se genera PNG embebido (base64).
4. Se renderiza la plantilla HTML con Handlebars y se exporta a PDF con Puppeteer.
5. Se guarda registro en DB y se abre el PDF resultante.

## Modo offline
- Si AFIP no responde o falta SDK, la emisión deja constancia en `facturas_estado` como `pendiente` y genera documento sin CAE (opcional). Al reconectar, se reintenta obtener CAE.

## Enlaces
- Configuración: ver `CONFIG_AFIP.md`.
- Plantillas y PDF: ver `PLANTILLAS_Y_PDF.md`.
- Flujo Caja/Admin: ver `FLUJO_CAJA_ADMIN.md`.
- Solución de problemas: ver `TROUBLESHOOTING.md`.
