## Guía de calibración y prueba de factura (PDFKit)

Esta guía explica cómo alinear (calibrar) la factura generada con PDFKit para que coincida exactamente con el modelo viejo, usando el fondo `MiFondo-pagado.jpg`.

### Archivos involucrados
- Layout (coordenadas en mm): `src/invoiceLayout.mendoza.ts`
- Render PDF: `src/pdfRenderer.ts`
- Script de calibración: `src/calibrate.ts`
- Ejemplo de factura ficticia: `src/renderExample.ts`
- Fondo JPG: `templates/MiFondo-pagado.jpg`
- Salidas: `test-output/calibration.pdf` y `test-output/FA_0016-00009207.NEW.pdf`

### Conceptos clave
- Todas las coordenadas están en milímetros (mm). Conversión interna: `mm(x) = x * 72 / 25.4`.
- Eje X (izq→der) y Eje Y (arriba→abajo). Si un texto aparece demasiado abajo, disminuir su `y`.
- El **layout** concentra todas las posiciones: editar solo `src/invoiceLayout.mendoza.ts` para mover campos.

### 1) Generar PDF de calibración
Sirve para ver rápidamente todas las posiciones de los campos sobre el fondo sin datos reales.

Pasos:
1. Compilar TypeScript:
   - `npm run build:ts`
2. Ejecutar calibración:
   - `node dist/src/calibrate.js`
3. Abrir `test-output/calibration.pdf` y comparar con el PDF viejo.

Qué verás:
- Rectángulos de borde rojo (40×6 mm por defecto) en cada coordenada del layout.
- Dentro de cada rectángulo, el nombre del campo (ej: `clienteNombre`, `fecha`, `nro`, etc.).

Ajustes rápidos:
- Mover un campo hacia arriba: reducir `y` (ej: `y: 52 → 50`).
- Mover un campo hacia la derecha: aumentar `x` (ej: `x: 16 → 18`).
- Repetir: guardar, `npm run build:ts`, `node dist/src/calibrate.js` y volver a abrir `calibration.pdf`.

Tamaño de cajas (opcional):
- En `src/calibrate.ts` podés cambiar `rectWidthMM` y `rectHeightMM` si alguna etiqueta no entra.

### 2) Ajustar coordenadas en el layout
Editar `src/invoiceLayout.mendoza.ts`:
- Letra de comprobante: `comprobanteLetra: { x, y }`
- Encabezado cliente: `clienteNombre`, `clienteDomicilio`, `clienteCuit`, `clienteIva`
- Fecha/hora: `fecha` o `fechaHora`
- Punto de venta y número: `pv`, `nro`
- Extra encabezado (opcionales): `atendio`, `condicionPago`, `referenciaInterna`, `notaRecepcion`, `remito`, `email`, `observaciones`
- Ítems (detalle):
  - Posición inicial de filas: `itemsStartY`
  - Alto de fila: `itemsRowHeight`
  - Columnas: `cols.cant`, `cols.desc`, `cols.unit`, `cols.alic`, `cols.total` (cada una con `{ x, w }`)
- Totales:
  - Neto total: `neto`
  - Netos por alícuota: `neto21`, `neto105`, `neto27`
  - IVA por alícuota: `iva21`, `iva105`, `iva27`
  - IVA total: `impIvaTotal`
  - Total final: `total`
  - En letras: `totalEnLetras { x, y, maxWidth }`
- CAE y vencimiento: `cae`, `caeVto`
- QR: `qr { x, y, size }` (tamaño en mm, típico 28)
- Textos legales/pie: `legalDefensaConsumidor`, `legalGracias`, `legalContacto`

Sugerencias:
- Ajustar en pasos de 1–2 mm hasta calzar perfecto.
- Mantener foco primero en encabezado, luego ítems, por último totales y pie.

### 3) Generar factura ficticia de prueba
Sirve para evaluar tipografías, alineaciones numéricas y wraps reales de descripciones.

Pasos:
1. Editar `src/renderExample.ts` y completar:
   - `tipoComprobanteLetra`, `fechaHora`, datos de cliente e ítems reales de prueba.
   - Opcional: agregar `qr_base64.txt` (data URL base64) si querés ver el QR.
2. Compilar TypeScript: `npm run build:ts`
3. Ejecutar ejemplo: `node dist/src/renderExample.js`
4. Abrir `test-output/FA_0016-00009207.NEW.pdf` y comparar con el PDF viejo.

Qué validar:
- Números alineados a la derecha con 2 decimales (unitario y total por línea, totales abajo).
- Wrap de descripciones dentro del ancho de columna definido (`cols.desc.w`).
- Separación entre filas según `itemsRowHeight`.
- Letra de comprobante bien centrada en el recuadro superior.
- CAE, Vencimiento y QR en sus posiciones exactas.
- Texto “SON PESOS: …” en posición y ancho correctos.

### 4) Tips y resolución de problemas
- Si todo aparece “corrida” verticalmente por igual, revisar escala/zoom de impresión (usar 100% sin márgenes).
- A4 recomendado: 210×297 mm; el JPG puede estirarse a página completa si no coincide.
- Si el QR no aparece, verificar `qr_base64.txt` (debe contener `data:image/...;base64,XXXX`).
- Los textos legales se definen en `pdfRenderer.ts` (pueden editarse o apagarse moviendo sus coordenadas fuera de página).
- Por defecto se usa fuente `Helvetica`/`Helvetica-Bold`. Se pueden registrar TTF si se requiere.

### 5) Checklist de campos (resumen)
- Letra: `comprobanteLetra`
- Cliente: `clienteNombre`, `clienteDomicilio`, `clienteCuit`, `clienteIva`
- Fecha/hora: `fecha` | `fechaHora`
- PV y Nro: `pv`, `nro`
- Extras: `atendio`, `condicionPago`, `referenciaInterna`, `notaRecepcion`, `remito`, `email`, `observaciones`
- Ítems: `itemsStartY`, `itemsRowHeight`, `cols.{cant,desc,unit,alic,total}`
- Totales: `neto`, `neto21`, `neto105`, `neto27`, `iva21`, `iva105`, `iva27`, `impIvaTotal`, `total`, `totalEnLetras`
- CAE/QR/Pie: `cae`, `caeVto`, `qr`, `legalDefensaConsumidor`, `legalGracias`, `legalContacto`

---
Con estos pasos, tu ayudante debería poder alinear la factura en pocos ciclos: generar `calibration.pdf`, ajustar mm en el layout, validar con la factura ficticia y repetir hasta que calce al 100% con el diseño viejo.


