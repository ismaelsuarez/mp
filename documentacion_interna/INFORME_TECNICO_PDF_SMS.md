## Objetivo

Documentar el flujo completo de creación de archivos .pdf a partir de archivos .txt en `src/flows/SmsProcessingFlow.ts`: detección, parsing, generación de imagen, composición con plantilla, creación de PDF, manejo de archivos, envío y reporting de errores.

## Resumen ejecutivo

- **Tipos que generan PDF**: `WPP`, `WPA`, `WPM`.
- **Estrategia común**: renderizar texto a imagen (Jimp) → componer con plantilla → generar PDF (PDFKit).
- **Diferencias clave**:
  - **WPP**: Genera PDF y crea un `.txt` `WFA...` para que otro paso envíe por WhatsApp.
  - **WPA**: Igual a WPP pero con plantilla diferente; también crea `WFA...`.
  - **WPM**: Genera PDF y lo envía por email; limpia PDF luego del envío (no crea `WFA...`).
- **Tolerancia a I/O**: espera hasta 15 s la aparición de archivos (`waitForFile`).
- **Limpieza**: borra temporales (imágenes y/o PDF según el caso) y maneja `Zone.Identifier` en Windows.
- **Errores**: reporte por email a `ADMIN_ERROR_EMAIL` o `SMTP_USER`.

## Detección, cola y parsing de archivos .txt

- Escaneo automático de carpeta `./sms` cada 20 s, con limpieza previa de `:Zone.Identifier`.
- Se encola cada `.txt` y se procesa en serie.
- El tipo se infiere por prefijo del nombre de archivo: `fileName.substring(0, 3)` → `wpp`, `wpa`, `wpm`, etc.
- Parsing por tipo (líneas del `.txt`):
  - **WPP / WPA**:
    1) Teléfono, 2) Cliente, 3) Nombre base del PDF (sin .pdf), 4+) Cuerpo del mensaje a renderizar.
  - **WPM**:
    1) Email destino, 2) Cliente, 3) Nombre base del PDF, 4+) Cuerpo del mensaje a renderizar.

## Dependencias y recursos

- Librerías externas:
  - `jimp`: renderizado de texto a imagen PNG y composición con plantilla.
  - `pdfkit`: creación de PDF a partir de imagen compuesta.
  - `fs/promises`, `path`: E/S y rutas de archivos.
- Funciones internas:
  - `generateTextImage(text, output, options)`: rasteriza el texto a PNG transparente.
  - `mergePdfWithImage(templatePng, textPng, outputPdf)`: compone imágenes y genera PDF con PDFKit.
  - `waitForFile(path, timeout=15000)`: polling hasta 15 s para confirmar existencia completa del archivo.
- Plantillas y fuentes:
  - Plantillas PNG: `src/plantilla/wp.png` (WPP), `src/plantilla/wpa.png` (WPA/WPM).
  - Fuentes BMFont: `src/fonts/CascadiaCode-.fnt` (WPP), `src/fonts/Consolas.fnt` (WPA/WPM).

## Flujo detallado por tipo

### WPP: Presupuesto a PDF + creación de WFA

1. Genera imagen del texto del mensaje con Jimp (tipografía y layout definidos).
2. Superpone la imagen de texto sobre la plantilla `wp.png`.
3. Genera el PDF en `public/<pdfFileName>.pdf` (intermedio) y espera hasta 15 s.
4. Mueve el PDF a `sms/<pdfFileName>.pdf`.
5. Crea `sms/wfaXXXXXXXX.txt` con: teléfono, cliente, nombre del PDF, caption fijo.
6. Limpia temporales (imagen de texto).

Puntos sensibles:
- Si el PDF no aparece en 15 s, aborta y loguea.
- El `WFA...txt` disparará el flujo de envío por WhatsApp en otra pasada.

### WPA: PDF con otra plantilla + creación de WFA

1. Genera imagen del texto del mensaje con Jimp.
2. Superpone sobre `wpa.png`.
3. Genera el PDF directamente en `sms/<pdfFileName>.pdf` y espera hasta 15 s.
4. Crea `sms/wfaXXXXXXXX.txt` con los datos para envío por WhatsApp.
5. Limpia temporales (imagen de texto).

Diferencia con WPP: ruta de salida del PDF (directo a `sms/`) y fuente/plantilla utilizada.

### WPM: PDF por email (sin WFA)

1. Parsea: email destino, nombre del contacto, nombre base del PDF y texto.
2. Genera imagen del texto y compone con `wpa.png`.
3. Genera el PDF en `sms/<pdfFileName>.pdf` y espera hasta 15 s.
4. Envía email (SMTP) con el PDF adjunto y firma HTML (`src/footer/firma.html`).
5. Limpia temporales (imagen y PDF tras el envío).

SMTP:
- Config `secure: true`, `port` desde `SMTP_PORT` (default 587), `host` `SMTP_HOST`, credenciales `SMTP_USER`/`SMTP_PASS`.

## Funciones clave de generación

### Render de texto a imagen (Jimp)

- Convierte texto multilinea en PNG con fondo transparente, aplicando `width`, `height`, `margin`, `fontSize`, `lineHeight`, `fontPath`.
- Imprime cada línea con `Jimp.print`, ajustando posición vertical incremental.

```javascript
// generateTextImage(textContent, outputPath, options)
const image = new Jimp(width, height, 0x00000000)
const font = await Jimp.loadFont(fontPath)
for (const line of lines) {
  image.print(
    font,
    margin,
    y,
    { text: line, alignmentX: Jimp.HORIZONTAL_ALIGN_LEFT },
    width - 2 * margin,
    height - 2 * margin
  )
  y += fontSize * lineHeight
}
await image.writeAsync(outputPath)
```

### Composición y PDF (Jimp + PDFKit)

- Lee plantilla y PNG de texto, compone con `template.composite(textImage, 0, 0)`.
- Guarda una imagen combinada temporal en `public/`.
- Crea un PDF sin página inicial automática y añade la imagen compuesta ajustada a la página.
- Elimina la imagen temporal combinada.

```javascript
// mergePdfWithImage(templateImagePath, textImagePath, outputPdfPath)
const template = await Jimp.read(templateImagePath)
const textImage = await Jimp.read(textImagePath)
template.composite(textImage, 0, 0)
const combinedImagePath = path.join(process.cwd(), 'public', `combined-${Date.now()}.png`)
await template.writeAsync(combinedImagePath)
const doc = new PDFDocument({ autoFirstPage: false })
doc.pipe(require('fs').createWriteStream(outputPdfPath))
doc.addPage().image(combinedImagePath, 0, 0, { fit: [doc.page.width, doc.page.height] })
doc.end()
await fs.unlink(combinedImagePath)
```

## E/S de archivos, rutas y limpieza

- Directorios:
  - Entrada de `.txt`: `./sms`.
  - Temporales: `./public` (imágenes intermedias y, en WPP, PDF intermedio), `./sms` (PDF final / adjuntos de email).
- Limpieza:
  - `WPP`: borra imagen de texto y mueve PDF de `public/` → `sms/`.
  - `WPA`: borra imagen de texto; el PDF queda en `sms/`.
  - `WPM`: borra imagen y PDF tras enviar email.
- Windows: elimina archivos `:Zone.Identifier` antes de procesar.

## Tiempos de espera y robustez

- `waitForFile(path, 15000)`: reintentos cada 1 s (hasta 15 s) para confirmar escritura completa.
- Al no existir a tiempo, registra error y (según tipo) envía reporte de error.

## Manejo de errores y reporting

- Categorías: `missing_file`, `processing_error`, `sending_error`.
- Reporte por email a `ADMIN_ERROR_EMAIL` (o `SMTP_USER` fallback) con metadatos: tipo, archivo, teléfono/email, cliente, mensaje, PDF esperado.
- Cuerpo del email incluye fecha/hora, acciones sugeridas y datos del contexto.

## Formatos de entrada .txt

- **WPP/WPA**:
  1) Número de teléfono
  2) Nombre del cliente
  3) Nombre base del PDF (sin `.pdf`)
  4+) Texto a renderizar en la página

- **WPM**:
  1) Email destino
  2) Nombre del contacto
  3) Nombre base del PDF (sin `.pdf`)
  4+) Texto a renderizar en la página

## Diagrama de flujo (WPP/WPA)

```mermaid
flowchart TD
  A[Detectar .txt en ./sms] --> B[Identificar tipo WPP/WPA]
  B --> C[Leer phone, client, pdfName, message]
  C --> D[generateTextImage(Jimp)]
  D --> E[mergePdfWithImage(Jimp+PDFKit)]
  E --> F{WPP?}
  F -- Sí --> G[Mover PDF a ./sms]
  F -- No (WPA) --> H[PDF ya en ./sms]
  G --> I[Crear .txt WFA con phone, client, pdf, caption]
  H --> I
  I --> J[WFA disparará envío por WhatsApp]
```

## Consideraciones y buenas prácticas

- Verificar existencia y compatibilidad de las fuentes `.fnt` y plantillas.
- Asegurar que `pdfFileName` sea válido para el sistema de archivos.
- En WPP, mover el PDF a `sms/` antes de crear `WFA...txt` (evita fallas en el envío).
- Monitorear tiempos >15 s; ajustar `waitForFile` si el entorno de disco es lento.
- SMTP: validar variables de entorno y disponibilidad de la firma `src/footer/firma.html`.

## Variables de entorno relevantes

- `ADMIN_ERROR_EMAIL` (receptor de reportes de error) — fallback: `SMTP_USER`.
- `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`.
- (Para WIP menú, no directamente PDF) `WIP_MENU_TITLE`, `PRODUCTS_PER_MESSAGE`, `MAX_MESSAGE_LENGTH`.
