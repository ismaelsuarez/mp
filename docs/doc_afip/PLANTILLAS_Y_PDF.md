# Plantillas y PDF (Handlebars + Puppeteer)

## Ubicación
- `src/modules/facturacion/templates/`
  - `factura_a.html`
  - `factura_b.html`
  - `nota_credito.html`
  - `recibo.html`

## Motor de plantillas
- Se usa Handlebars para inyectar datos (emisor, receptor, comprobante, items, totales, AFIP).
- Placeholders típicos:
  - `{{emisor.razonSocial}}`, `{{emisor.cuit}}`, `{{emisor.logoPath}}`
  - `{{receptor.nombre}}`, `{{receptor.documento}}`
  - `{{comprobante.tipo}}`, `{{comprobante.puntoVenta}}`, `{{numero_formateado}}`, `{{fecha_formateada}}`
  - Loop de items: `{{#each comprobante.items}} ... {{/each}}`
  - Totales: `{{comprobante.totales.neto}}`, `{{comprobante.totales.iva}}`, `{{comprobante.totales.total}}`
  - AFIP: `{{afip.cae}}`, `{{afip.vencimientoCAE}}`, `{{qr_data_url}}`

## QR AFIP
- Se construye la URL oficial y se genera PNG base64 con `qrcode`.
- En plantilla se referencia con `<img src="{{qr_data_url}}" />`.

## Render a PDF
- Puppeteer carga el HTML y exporta a A4 con fondos (`printBackground: true`).
- Salida en: `Documentos/facturas/` con nombre `TIPO_NUMERO.pdf`.

## Estilos/branding
- Plantillas soportan `<img src="file://{{emisor.logoPath}}">`.
- Ajustar CSS en cada HTML según necesidad.

## Buenas prácticas
- Mantener márgenes y tamaños tipográficos legibles.
- Evitar rutas relativas a Internet (sin conexión fallarán). Prefiera rutas locales.
- Testear con distintos locales/regionales para decimales/fechas.
