## Remito — Circuito completo (UI → IPC → Lógica → PDF → Impresión)

### Introducción y propósito
- **Qué es un Remito**: documento de entrega de mercadería/servicio sin interacción AFIP (no requiere CAE). Se genera desde un archivo `.fac` con `TIPO: REMITO` y nombre que termina en `R.fac`.
- **Objetivo**: replicar el circuito de Recibo adaptado a Remitos: numeración local, PDF con prefijo `REM_`, `.res` con sufijo `r` minúscula, impresión silenciosa, envíos a red/EMAIL/WhatsApp y limpieza.

### Arquitectura general
- **UI (renderer)**: `public/config.html` — Sección “Remitos” para PV, numeración, rutas y selección de impresora.
- **Preload**: `src/preload.ts` — expone IPC a la UI (`remito.getConfig`, `remito.saveConfig`).
- **IPC (main process)**: `src/main.ts` — handlers para `remito:get-config` / `remito:save-config`, y cola de procesamiento para `.fac` (enruta por tipo).
- **Lógica de Remito**: `src/modules/facturacion/remitoProcessor.ts` — parsea `.fac` `TIPO: REMITO`, genera PDF `REM_`, copias a red, impresión, EMAIL, WhatsApp (wfa*.txt) y `.res` con sufijo `r`.
- **Servicio de impresión**: `src/services/PrintService.ts` — `pdf-to-printer`.
- **Servicio de email**: `src/services/EmailService.ts` — `sendReceiptEmail` reutilizado con asunto/título “Remito”.
- **Generación de PDF**: `src/pdfRenderer.ts` + `src/invoiceLayout.mendoza.ts`.
- **Persistencia de configuración**: `config/remito.config.json`.

Descripción textual del flujo completo:
1) La UI permite configurar **PV**, **Número inicial (NI)**, **rutas** de salida (Local/Red1/Red2) y **impresora** específica de Remitos.
2) Llega un `.fac` de Remito (nombre termina en `R.fac` y `TIPO: REMITO`). La cola de `.fac` en `main.ts` encola el archivo y lo enruta al procesador de Remitos.
3) Se genera el PDF local con nombre `REM_<PV-4>-<NUM-8>.pdf` bajo `Ventas_PV{pv}/F{YYYYMM}/`.
4) Desde la copia local, se realizan copias a Red1/Red2 si están configuradas.
5) Si el `.fac` define `COPIAS: N` (N>0), se imprime silenciosamente con `pdf-to-printer` usando la impresora configurada para Remitos (o predeterminada si no hay `printerName`).
6) Si el `.fac` trae `EMAIL:`, se envía automáticamente el PDF adjunto (asunto y título: “Remito”).
7) Si el `.fac` trae `WHATSAPP:`, se crea `wfa*.txt` con número normalizado con `+54`, nombre del cliente, nombre del PDF y mensaje fijo; se envían PDF + `wfa*.txt` por SFTP/FTP al destino WhatsApp y, tras éxito, se elimina el `wfa*.txt` local.
8) Se genera el `.res` alterando el sufijo a `r` minúscula y se envía por FTP. Tras envío exitoso, se eliminan `.res` y `.fac`.
9) Se incrementa el contador en `remito.config.json`.

### Flujo paso a paso

#### 1) Interfaz de Usuario (panel Remitos)
- Ubicación: `public/config.html`, sección “Remitos”. Campos: PV, NI, rutas `outLocal`, `outRed1`, `outRed2`, selector de impresora, botón “Guardar Remito”.
- La UI lee y guarda configuración vía `window.api.remito.getConfig()` y `window.api.remito.saveConfig(cfg)`. También lista impresoras con `window.api.printers.list()`.

#### 2) Preload: exposición de APIs a la UI
- Ubicación: `src/preload.ts`.
- Bloque expuesto:
  - `remito.getConfig: () => ipcRenderer.invoke('remito:get-config')`
  - `remito.saveConfig: (cfg) => ipcRenderer.invoke('remito:save-config', cfg)`

#### 3) IPC en `main.ts`
- Ubicación: `src/main.ts`.
- Handlers:
  - `remito:get-config` — lee `config/remito.config.json`.
  - `remito:save-config` — merge conservador: actualiza solo las claves presentes en el payload; `printerName` es opcional.
- Cola `.fac` (secuencial): al detectar un archivo, se encola; el procesador único lee `TIPO:` del contenido y enruta a Recibo o Remito. Cualquier error en un archivo no detiene la cola.

#### 4) Lógica principal de Remito (`remitoProcessor.ts`)
- Ubicación: `src/modules/facturacion/remitoProcessor.ts`.
- Responsabilidades:
  - Parsear `.fac` `TIPO: REMITO` → estructura con cliente, ítems, pagos, totales y observaciones.
  - Construir paths de salida `Ventas_PV{pv}/F{YYYYMM}/` y nombre `REM_<pv-4>-<contador-8>.pdf`.
  - Generar PDF con `generateInvoicePdf` y layout `invoiceLayout.mendoza`.
  - Copiar a Red1/Red2 desde la copia local.
  - Imprimir silencioso según `COPIAS:` con `PrintService.printPdf(localOutPath, printerName, copies)`.
  - Si `EMAIL:`, enviar el PDF con `EmailService.sendReceiptEmail` (asunto/título “Remito”).
  - Si `WHATSAPP:`, crear `wfa*.txt` (nombre único `wfaHHmmssXX.txt`) con número normalizado `+54`, enviar PDF + wfa por SFTP/FTP y borrar el wfa local tras éxito.
  - Incrementar contador al finalizar el render.
  - Generar `.res` con sufijo `r` minúscula (tomando los últimos 8 del base del `.fac`, reemplazando la última letra por `r`) y enviarlo por FTP. Tras éxito, borrar `.res` y `.fac`.

Detalles relevantes implementados:
- **Normalización WhatsApp**: si el número no comienza con `+54`, se antepone `+54` al número (se filtran no-dígitos, se construye `+54<digits>` o `+<digits>` si ya inicia con `54`).
- **wfa*.txt único**: se usa `HHmmss` + 2 caracteres aleatorios para evitar colisiones cuando llegan múltiples `.fac` simultáneos.
- **Impresión**: utiliza `remitoCfg.printerName` si existe; si no, impresora predeterminada del sistema.
- **Cola secuencial**: evita condiciones de carrera y garantiza que cada `.fac` solo se borra luego de completar su propio flujo.

### Generación del PDF (detalle)
- Motor: `generateInvoicePdf` en `src/pdfRenderer.ts` (usa `pdfkit`), con layout `src/invoiceLayout.mendoza.ts`.
- Datos: empresa (pv/número), cliente, fecha/hora, ítems/pagos, totales, observaciones, remito opcional, leyendas.
- Rutas: `Ventas_PV{pv}/F{YYYYMM}` bajo `outLocal`; copias a Red1 y Red2 si están configuradas.

### Ajustes específicos implementados (últimas actualizaciones)
- Lógica de `OBS.PIE:` alineada con Recibo:
  - Parseo en `src/modules/facturacion/remitoProcessor.ts` separa la línea de “GRACIAS” del resto del pie (igual que Recibo).
  - El renderer imprime únicamente el contenido de `OBS.PIE:` para Remito (no agrega textos legales por defecto).
  - Log de diagnóstico: `[renderer] Remito pie length: N` para verificar que el pie llegó al renderer.
- Overrides de coordenadas solo para Remito en el layout (mecanismo general):
  - El renderer fusiona `coords.<campo>` con `coords.<campo>Remito` cuando `tipo=REMITO`.
  - Usado actualmente para:
    - `pieObservacionesRemito`: subir el pie en Remito (fondo distinto).
    - `fechaRemito`/`fechaHoraRemito`: ajustar tamaño/posición de fecha.
    - `numeroRemito`: ajustar tamaño/posición del número de comprobante (en Remito se usa `coords.numero`).
  - Otros overrides disponibles en el layout para encuadre fino: `clienteNombreRemito`, `clienteDomicilioRemito`, `clienteCuitRemito`, `clienteIvaRemito`, `tipoComprobanteRemito`, `pvRemito`, `atendioRemito`, `condicionPagoRemito`, `horaRemito`, `emailRemito`, `notaRecepcionRemito`, `remitoRemito`, `observacionesRemito`, `totalEnLetrasRemito`.
- Ítems sin importes en Remito:
  - El renderer oculta columnas de unitario/IVA/total si no hay valores (>0), imprimiendo solo cantidad y descripción.
- Totales en Remito:
  - Si todos los totales/ivas/netos son cero, se omite por completo el bloque de totales (incluye “Total en letras”).

### Archivos tocados en esta iteración
- `src/modules/facturacion/remitoProcessor.ts`: unificación de parseo de `OBS.PIE:` con Recibo.
- `src/pdfRenderer.ts`: mecanismo de overrides `*Remito`, uso de `coords.numero` en Remito, pie y fecha condicionados por tipo.
- `src/invoiceLayout.mendoza.ts`: agregados `pieObservacionesRemito`, `fechaRemito`, `numeroRemito` y overrides opcionales.
- `scripts/remito-from-fac.js`: alinea el parseo y traspaso de `pieObservaciones`/“GRACIAS” con producción para pruebas locales.

### Pruebas de aceptación (añadidos)
- Con un `.fac` de Remito que incluya `OBS.PIE:` y la línea de “GRACIAS”, verificar:
  - El PDF resultante muestra el pie en la posición ajustada (según `pieObservacionesRemito`).
  - La fecha usa el tamaño/posición de `fechaRemito`.
  - El número de comprobante usa `coords.numero` con override `numeroRemito`.
  - En consola aparece `[renderer] Remito pie length: N` (N>0).

### Envío por email
- Detección: si existe `EMAIL:` en el `.fac`.
- Servicio: `sendReceiptEmail(to, pdfPath, { subject: 'Remito', title: 'Remito', intro: 'Adjuntamos el remito correspondiente.', bodyHtml: '<p>Gracias por su preferencia.</p>' })`.
- Manejo de errores: no interrumpe el flujo si falla.

### Envío por WhatsApp
- Detección: si existe `WHATSAPP:` en el `.fac`.
- Normalización del teléfono: se asegura prefijo `+54`.
- `wfa*.txt` (nombre único):
  - Ubicación: misma carpeta local del PDF.
  - Contenido (líneas): teléfono normalizado, nombre del cliente, nombre del PDF, mensaje fijo.
- Envío: `FtpService.sendFilesToWhatsappFtp([pdf, wfa], [pdfName, wfaName])` por SFTP (preferente) o FTP según config.
- Limpieza: borra `wfa*.txt` local tras confirmarse la subida.

### Impresión
- Servicio: `src/services/PrintService.ts` con `pdf-to-printer`.
- Selección de impresora: `printerName` en `remito.config.json` (opcional). Si no, predeterminada del sistema.
- Modo depuración: `PRINT_DEBUG=1` muestra ruta, impresora y copias.

### Configuración y persistencia
- Archivo: `config/remito.config.json`.
- Formato:

```json
{
  "pv": 1,
  "contador": 1,
  "outLocal": "C:\\1_AFIP",
  "outRed1": "\\\\correo\\backup\\Presupuestos y Licitaciones\\FACTURAS",
  "outRed2": "\\\\server2008\\backup\\Presupuestos y Licitaciones\\FACTURAS",
  "printerName": "HP LaserJet (opcional)"
}
```

- Escritura: la UI dispara `remito:save-config` con merge conservador (solo actualiza claves presentes). `printerName` se respeta si viene definido.

#### Claves de configuración para WhatsApp (global)
Se reutiliza la misma configuración global `FTP_WHATSAPP_*` usada por Recibo (SFTP/FTP, directorio remoto, etc.).

### Módulos auxiliares y dependencias
- `pdfkit`: motor de composición.
- `pdf-to-printer`: impresión silenciosa.
- `dayjs`: fechas/carpetas (`FYYYYMM`).
- `basic-ftp`: envío de `.res`.
- `ssh2-sftp-client`: canal SFTP para WhatsApp.
- `nodemailer`: emails (SMTP).

### Consideraciones de seguridad y buenas prácticas
- Generar siempre local y luego copiar a red.
- Validar permisos en `outLocal`.
- Evitar imprimir archivos en escritura; el servicio verifica existencia y tamaño.
- No loguear contraseñas SMTP/FTP/SFTP.
- Validar huella SSH del servidor SFTP (persistida y verificada en conexiones sucesivas).

### Extensibilidad
- La cola y el patrón de módulos permiten incorporar otros comprobantes (Facturas, Notas de Crédito) reusando: UI + IPC + preload + procesador propio + layout.
- Sugerencia: factorizar campos comunes del parser si se agregan más tipos.

### Pruebas de aceptación
1) Colocar un `.fac` de Remito con `TIPO: REMITO` que termine en `R.fac` con `EMAIL:` y `WHATSAPP:`.
2) Verificar:
   - PDF local en `Ventas_PV{pv}/F{YYYYMM}` con nombre `REM_<pv-4>-<num-8>.pdf`.
   - Copias en Red1/Red2 si están configuradas.
   - Envío de email con adjunto.
   - Creación de `wfa*.txt`, envío de PDF + wfa por SFTP/FTP y borrado del wfa local tras éxito.
   - `.res` con sufijo `r` minúscula enviado por FTP y luego borrado junto con el `.fac`.
   - Impresión silenciosa según `COPIAS:` y `printerName` configurado.
3) Prueba de concurrencia: colocar múltiples `.fac` simultáneos; se deben encolar y procesar sin pérdidas ni borrados prematuros.

---

Notas finales
- Este circuito replica fielmente el de Recibo, adaptando prefijos/sufijos y textos (“Remito”).
- La cola secuencial en `main.ts` garantiza robustez ante arrivals simultáneos y evita condiciones de carrera.


