## Recibo — Circuito completo (UI → IPC → Lógica → PDF → Impresión)

### Introducción y propósito
- **Qué es un Recibo**: en este sistema, el “Recibo” es una constancia de pago que se genera a partir de un archivo `.fac` de tipo `RECIBO`, produce un PDF con layout predefinido y, opcionalmente, lo imprime de forma silenciosa.
- **Objetivo**: dejar trazado un circuito robusto y documentado que sirva como plantilla para implementar otros comprobantes (Remito, Factura A/B/C, Nota de Crédito A/B/C) cambiando solo la capa de datos y validaciones específicas.
- **Relación con Facturación**: el Recibo reutiliza la infraestructura de generación de PDF y la capa de impresión compartida con facturación; no realiza interacción AFIP (CAE) ya que es una constancia de pago y no un comprobante fiscal electrónico ante AFIP.

### Arquitectura general
- **UI (renderer)**: `public/config.html` — Panel “Recibos” para configurar PV, numeración, rutas de salida y listado de impresoras.
- **Preload**: `src/preload.ts` — expone IPC seguros a la UI (`recibo.getConfig`, `recibo.saveConfig`, `printers.list`, `printers.printPdf`).
- **IPC (main process)**: `src/main.ts` — handlers para leer/guardar configuración de Recibo y listar/usar impresoras.
- **Lógica de Recibo**: `src/modules/facturacion/facProcessor.ts` — parsea `.fac`, arma datos, genera el PDF, copia a rutas configuradas y dispara impresión silenciosa.
- **Servicio de impresión**: `src/services/PrintService.ts` — usa `pdf-to-printer` para enviar el PDF al spooler del SO evitando el bug de “página negra”.
- **Servicio de email**: `src/services/EmailService.ts` — envío de correo con adjunto PDF mediante SMTP. Usa plantilla HTML `templates/email/document.html` (firma fija, estilo corporativo).
- **Generación de PDF**: `src/pdfRenderer.ts` + `src/invoiceLayout.mendoza.ts` — motor de render y layout (títulos, textos, posiciones, tipografías, fondos).
- **Persistencia de configuración**: archivo JSON `config/recibo.config.json`.

Descripción textual del flujo completo:
1) El usuario configura **PV**, **Número inicial (NI)** y **rutas** de salida locales y de red en la UI. La UI consulta y guarda mediante IPC.
2) Llega un archivo `.fac` con `TIPO: RECIBO` (p. ej., por FTP server a una carpeta local). El módulo `facProcessor` lo parsea y construye la estructura de datos.
3) Se genera el PDF en el destino local, en una ruta con patrón: `Ventas_PV{pv}/F{YYYYMM}/REC_{PV-4}-{NUM-8}.pdf`.
4) Desde la copia local, se realizan copias a Red1/Red2 si están configuradas.
5) Si el `.fac` define `COPIAS: N` (N>0), se dispara la impresión silenciosa con `pdf-to-printer`. Si no se definió impresora, se usa la predeterminada del sistema.
6) Si el `.fac` trae `EMAIL: usuario@dominio`, se envía automáticamente el PDF adjunto al correo, con asunto y cuerpo adecuados para el tipo de comprobante (en Recibo: “Recibo de pago”).
7) Si el `.fac` trae `WHATSAPP: <numero>`, se genera un archivo `wfa*.txt` (nombre único) con: teléfono normalizado con prefijo `+54`, nombre del cliente, nombre del PDF y un mensaje fijo; luego se envían el PDF y el `wfa*.txt` al destino de WhatsApp (SFTP/FTP) y, tras éxito, se elimina el `wfa*.txt` local.

### Flujo paso a paso

#### 1) Interacción de la UI (panel Recibos)
- Ubicación: `public/config.html`, sección “Recibos”. Campos: PV, NI, rutas `outLocal`, `outRed1`, `outRed2` y combo de impresoras (informativo/diagnóstico en estado actual).

```1304:1377:public/config.html
(function setupReciboUI(){
    // Carga de config, población de PV/NI/rutas y listado de impresoras
    const res = await window.api.recibo.getConfig();
    // ...
    btn.addEventListener('click', async () => {
        const payload = { pv, contador, outLocal, outRed1, outRed2 };
        const save = await window.api.recibo.saveConfig(payload);
        // feedback UI
    });
    // Test impresión (informativo)
    // alert indicando que la impresión se realiza al generar PDF desde .fac
})();
```

- La UI obtiene y guarda la configuración vía Preload (ver más abajo). El combo de impresoras se llena con `printers:list` para diagnóstico; la selección no se persiste en el estado actual base.

#### 2) Preload: exposición de APIs a la UI
- Ubicación: `src/preload.ts`.

```163:171:src/preload.ts
recibo: {
    getConfig: () => ipcRenderer.invoke('recibo:get-config'),
    saveConfig: (cfg: { pv?: number; contador?: number; outLocal?: string; outRed1?: string; outRed2?: string }) => ipcRenderer.invoke('recibo:save-config', cfg),
},
printers: {
    list: () => ipcRenderer.invoke('printers:list'),
    printPdf: (filePath: string, printerName?: string, copies?: number) => ipcRenderer.invoke('printers:print-pdf', { filePath, printerName, copies }),
},
```

#### 3) IPC en `main.ts`
- Ubicación: `src/main.ts`. Lee/guarda `recibo.config.json` y lista impresoras del sistema.

```2782:2806:src/main.ts
ipcMain.handle('recibo:get-config', async () => {
  try {
    const cfg = readReciboCfg();
    return { ok: true, config: cfg };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
});

ipcMain.handle('recibo:save-config', async (_e, cfg: { pv?: number; contador?: number; outLocal?: string; outRed1?: string; outRed2?: string }) => {
  try {
    const current = readReciboCfg();
    const next = {
      pv: typeof cfg?.pv === 'number' ? cfg.pv : current.pv,
      contador: typeof cfg?.contador === 'number' ? cfg.contador : current.contador,
      outLocal: typeof cfg?.outLocal === 'string' ? cfg.outLocal : current.outLocal,
      outRed1: typeof cfg?.outRed1 === 'string' ? cfg.outRed1 : current.outRed1,
      outRed2: typeof cfg?.outRed2 === 'string' ? cfg.outRed2 : current.outRed2,
    };
    const res = writeReciboCfg(next);
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
});
```

```2808:2835:src/main.ts
ipcMain.handle('printers:list', async () => {
  try {
    const win = BrowserWindow.getAllWindows()[0];
    let list: any[] = [];
    if (win) {
      const wc: any = win.webContents as any;
      if (typeof wc.getPrintersAsync === 'function') {
        list = await wc.getPrintersAsync();
      } else if (typeof wc.getPrinters === 'function') {
        list = wc.getPrinters();
      }
    }
    return { ok: true, printers: list || [] };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
});

ipcMain.handle('printers:print-pdf', async (_e, { filePath, printerName, copies }: { filePath: string; printerName?: string; copies?: number }) => {
  try {
    await printPdf(filePath, printerName, copies || 1);
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
});
```

#### 4) Lógica principal de Recibo (`facProcessor.ts`)
- Ubicación: `src/modules/facturacion/facProcessor.ts`.
- Responsabilidades:
  - Parsear `.fac` de tipo `RECIBO` → `ParsedRecibo`.
  - Construir paths de salida siguiendo el patrón `Ventas_PV{pv}/F{YYYYMM}/`.
  - Generar PDF con `generateInvoicePdf` y `invoiceLayout.mendoza`.
  - Copiar a rutas de red (Red1/Red2) desde la copia local.
  - Imprimir silencioso según `COPIAS:` usando `PrintService.printPdf`.
  - Generar `.res`, enviarlo por FTP y, si fue exitoso, borrar `.res` y el `.fac` original.
  - Si se detecta `EMAIL:` en el `.fac`, enviar el PDF por email usando `EmailService.sendReceiptEmail` con plantilla corporativa.

Parseo y armado de datos (extracto):
```50:96:src/modules/facturacion/facProcessor.ts
function parseFacRecibo(content: string, fileName: string): ParsedRecibo {
  const lines = String(content || '').split(/\r?\n/);
  const get = (key: string) => { /* ... */ };
  const getBlock = (startKey: string) => { /* ... */ };
  // DIAHORA → fechaISO y refInterna
  // FONDO, COPIAS, MONEDA
  // Receptor: CLIENTE, TIPODOC, NRODOC, CONDICION, IVARECEPTOR, DOMICILIO
  // Items y Pagos
  // Totales
  // Observaciones y agradecimiento
  return { /* ParsedRecibo */ };
}
```

Generación de carpetas y PDF, copias y print silencioso (extracto):
```248:323:src/modules/facturacion/facProcessor.ts
const pvStr = String(reciboCfg.pv).padStart(4, '0');
const nroStr = String(reciboCfg.contador).padStart(8, '0');
const fileName = `REC_${pvStr}-${nroStr}.pdf`;

function buildMonthDir(rootDir: string | undefined): string | null {
  const venta = path.join(root, `Ventas_PV${Number(reciboCfg.pv)}`);
  const yyyymm = dayjs(parsed.fechaISO).format('YYYYMM');
  const monthDir = path.join(venta, `F${yyyymm}`);
  fs.mkdirSync(monthDir, { recursive: true });
  return monthDir;
}

const outLocalDir = buildMonthDir((reciboCfg as any).outLocal || '');
// ... Red1 / Red2
const localOutPath = path.join(outLocalDir, fileName);

await generateInvoicePdf({ bgPath, outputPath: localOutPath, data, config: layoutMendoza, qrDataUrl: undefined });

// Copiar a Red1/Red2 (desde local)
fs.copyFileSync(localOutPath, path.join(dstDir, name));

// Impresión según COPIAS
const { printPdf } = await import('../../services/PrintService');
await printPdf(localOutPath, undefined, copies);
```

Generación y envío de `.res` por FTP (extracto):
```327:365:src/modules/facturacion/facProcessor.ts
// .res junto con el .fac original; nombre = últimos 8 caracteres, en minúscula
const baseName = path.basename(fullPath, path.extname(fullPath));
const shortBaseLower = baseName.slice(-8).toLowerCase();
resPath = path.join(dir, `${shortBaseLower}.res`);
fs.writeFileSync(resPath, joined, 'utf8');

// Enviar .res por FTP y borrar .res y .fac tras éxito
await sendArbitraryFile(resPath, path.basename(resPath));
fs.unlinkSync(resPath);
fs.unlinkSync(fullPath);
```

#### 5) Servicio de impresión (`PrintService.ts`)
- Ubicación: `src/services/PrintService.ts`.
- Utiliza `pdf-to-printer` para enviar el PDF directamente al spooler del SO, evitando el motor de render Chromium/Electron y el bug de “página negra”. API pública estable:

```1:46:src/services/PrintService.ts
// Refactor: Abandonamos webContents.print para evitar el bug de “página negra”.
// Enviamos el PDF directamente al spooler del SO usando pdf-to-printer.
import { print as printNative } from 'pdf-to-printer';
import path from 'path';

const DEBUG_PRINT = process.env.PRINT_DEBUG === '1';

export async function printPdf(filePath: string, printerName?: string, copies: number = 1): Promise<void> {
  if (!filePath) return;
  const abs = path.resolve(filePath);
  if (DEBUG_PRINT) console.log('[PrintService] pdf-to-printer print', { filePath: abs, printerName, copies });
  // Verificación de archivo existente y no vacío
  // ...
  await printNative(abs, {
    printer: printerName || undefined,
    copies: Math.max(1, Math.floor(copies || 1)),
  } as any);
}
```

### Generación del PDF (detalle)
- Motor: `generateInvoicePdf` en `src/pdfRenderer.ts` (usa `pdfkit`), con layout específico `src/invoiceLayout.mendoza.ts`.
- Datos principales mapeados desde `ParsedRecibo`: empresa (pv/numero), cliente, fecha/hora, items/pagos, totales, observaciones, leyendas y “gracias”.
- Fondos: se busca `FONDO:` en `.fac`. Si no hay, se usan candidatos por defecto `templates/MiFondoRe.jpg` o `templates/MiFondoRm.jpg`; fallback `public/Noimage.jpg`.
- QR AFIP: para Recibo no se incluye CAE ni QR fiscal (no es comprobante fiscal AFIP), pero el motor soporta QR para otros comprobantes.
- Validaciones previas: existencia de ruta local obligatoria; creación recursiva de `Ventas_PV{pv}/F{YYYYMM}`; numeración correlativa persistida en `recibo.config.json`.

### Envío por email (nuevo)
- Detección: en el parseo de `.fac` se agrega el campo opcional `email` cuando existe una línea `EMAIL:`.
- Servicio: `src/services/EmailService.ts` implementa `sendReceiptEmail(to, pdfPath, options)` usando `nodemailer` y configuración SMTP (host, puerto, usuario, contraseña) ya disponibles en la app.
- Plantilla: `templates/email/document.html` con diseño corporativo y firma fija (bloque inferior izquierdo). El servicio reemplaza placeholders básicos (`{{title}}`, `{{intro}}`, `{{body}}`) y adjunta el PDF generado.
- Recibo: se invoca con `subject/title = "Recibo de pago"`, `intro = "Adjuntamos el recibo correspondiente."`, `bodyHtml = "<p>Gracias por su preferencia.</p>"`.
- Manejo de errores: si el envío falla, se registra una advertencia y el flujo de generación/impresión/FTP continúa sin interrumpirse.

### Envío por WhatsApp (nuevo)
- Detección: si en el `.fac` existe una línea `WHATSAPP:`, se activa el flujo de WhatsApp.
- Normalización del teléfono: el número se normaliza agregando el prefijo `+54` si no estuviera presente.
  - Ejemplos: `2615945032` → `+542615945032`; `+542615945032` → se mantiene.
- Archivo de instrucción `wfa*.txt` (nombre único):
  - Ubicación: misma carpeta local donde se genera el PDF del recibo.
  - Nombre: `wfaHHmmssXX.txt` (hora `HHmmss` + 2 caracteres aleatorios) para evitar colisiones simultáneas.
  - Contenido (líneas):
    1. Teléfono normalizado (con `+54`).
    2. Nombre del cliente (parseado del `.fac`).
    3. Nombre del archivo PDF (con extensión).
    4+. Mensaje fijo: `Que tal, somos de Todo Computacion` y `Adjuntamos \"el recibo realizado.\"`.
- Envío a destino WhatsApp: se suben el PDF y el `wfa*.txt` usando `FtpService.sendFilesToWhatsappFtp(...)` por SFTP (preferente) o FTP según configuración.
- Limpieza: tras confirmarse la subida de ambos archivos, se elimina localmente el `wfa*.txt`.
- Robustez: si el envío falla, se registra advertencia pero no se bloquea el resto del flujo del Recibo.

### Impresión
- Se realiza luego de guardar el PDF local y de copiarlo a Red1/Red2.
- Servicio: `src/services/PrintService.ts` con `pdf-to-printer`.
- Selección de impresora: la UI lista impresoras con `printers:list`. En el estado base, `facProcessor` invoca `printPdf(localOutPath, undefined, copies)`, por lo que si no se especifica impresora se usa la predeterminada del sistema. La API permite pasar `printerName` si se habilita en la configuración.
- Modo depuración: habilitar `PRINT_DEBUG=1` para ver logs de impresora, ruta y copias.

### Configuración y persistencia
- Archivo: `config/recibo.config.json`.
- Formato actual (estado base):

```json
{
  "pv": 1,
  "contador": 1,
  "outLocal": "C:\\1_AFIP",
  "outRed1": "\\\\correo\\backup\\Presupuestos y Licitaciones\\FACTURAS",
  "outRed2": "\\\\server2008\\backup\\Presupuestos y Licitaciones\\FACTURAS"
}
```

- Lectura/escritura: vía IPC `recibo:get-config` / `recibo:save-config` (ver extractos en `src/main.ts`).
- Nota sobre impresora: el circuito de impresión soporta `printerName` a nivel API. Para persistirlo, se puede extender `recibo.config.json` agregando el campo opcional `printerName` y adaptar `save-config` para conservarlo (sin afectar PV/NI/rutas).

#### Claves de configuración para WhatsApp (en configuración global)
Se emplea la configuración global para el canal WhatsApp vía SFTP/FTP:

```json
{
  "FTP_WHATSAPP_IP": "149.50.143.141",
  "FTP_WHATSAPP_PORT": 5013,
  "FTP_WHATSAPP_USER": "root",
  "FTP_WHATSAPP_PASS": "*****",
  "FTP_WHATSAPP_SECURE": false,
  "FTP_WHATSAPP_DIR": "/home/smsd/todocomputacion/sms",
  "FTP_WHATSAPP_SFTP": true,
  "FTP_WHATSAPP_SSH_FP": "<huella_sha256_hex>"
}
```

- `FTP_WHATSAPP_SFTP=true` fuerza SFTP (recomendado para evitar timeouts PASV/EPSV de FTP clásico).
- En primera conexión SFTP, se captura y persiste la huella de la clave del host (`FTP_WHATSAPP_SSH_FP`) para validarla en conexiones futuras.

### Módulos auxiliares y dependencias
- `pdfkit`: motor de composición de PDFs (textos, fuentes, imágenes, etc.).
- `pdf-to-printer`: impresión silenciosa a spooler nativo, evitando render Chromium.
- `dayjs`: formateo de fechas (p. ej., carpeta `FYYYYMM`).
- `basic-ftp` (en servicio FTP): para envío de `.res` tras generar/imprimir.
- `ssh2-sftp-client`: canal SFTP para el destino WhatsApp (evita problemas PASV/EPSV, usa un único puerto configurable).
- `nodemailer`: envío de emails con adjuntos usando SMTP.

### Consideraciones de seguridad y buenas prácticas
- Rutas de salida: asegurar permisos de escritura en `outLocal`. Evitar rutas de red inestables para render inicial; siempre generar local y luego copiar.
- Drivers y fuentes: validar drivers en producción; instalar fuentes requeridas por el layout para evitar sustituciones.
- Impresión silenciosa: `pdf-to-printer` requiere colas accesibles; probar con impresoras de red autenticadas.
- Manejo de archivos temporales: evitar imprimir desde archivos aún en escritura; el servicio valida tamaño > 0.
- Email/seguridad: no se registran contraseñas SMTP en logs; se valida formato básico del email antes de enviar.

### Extensibilidad (patrón para otros comprobantes)
- **Partes comunes**:
  - UI: panel de configuración (PV/NI/rutas) y, opcionalmente, selector de impresora.
  - Preload e IPC: `get-config`/`save-config`, `printers:list`/`print-pdf`.
  - Lógica: lectura `.fac`, construcción de datos, `generateInvoicePdf` y copias locales/red.
  - Impresión: `printPdf(pdfPath, printerName?, copies)`.
- **Partes que cambian**:
  - Parseo `.fac` (tags específicos por tipo de comprobante).
  - Layout: archivo de layout (posiciones, títulos, leyendas). Para factura/notas, incluir CAE/QR y validaciones AFIP.
  - Reglas de numeración y prefijos de nombres de archivo (p. ej., `FA_`, `FB_`, `NC_`, `REM_`).
  - Interacción AFIP (solo para facturas/notas): solicitar CAE y persistir metadatos.

### Apéndices

#### A) Ejemplo de `recibo.config.json`
```json
{
  "pv": 16,
  "contador": 9207,
  "outLocal": "C:\\1_AFIP",
  "outRed1": "\\\\correo\\backup\\Presupuestos y Licitaciones\\FACTURAS",
  "outRed2": "\\\\server2008\\backup\\Presupuestos y Licitaciones\\FACTURAS"
}
```

#### B) Ejemplo de log de impresión (PRINT_DEBUG=1)
```text
[PrintService] pdf-to-printer print { filePath: "C:\\1_AFIP\\Ventas_PV16\\F202509\\REC_0016-00009207.pdf", printerName: undefined, copies: 2 }
```

#### C) Salida esperada al generar Recibo
```text
PDF local: C:\\1_AFIP\\Ventas_PV16\\F202509\\REC_0016-00009207.pdf
Copias a red:
  \\correo\backup\Presupuestos y Licitaciones\FACTURAS\Ventas_PV16\F202509\REC_0016-00009207.pdf
  \\server2008\backup\Presupuestos y Licitaciones\FACTURAS\Ventas_PV16\F202509\REC_0016-00009207.pdf
Impresión: 2 copias (impresora predeterminada)
Email: enviado a la dirección presente en `EMAIL:` si corresponde (asunto: "Recibo de pago").
WhatsApp: generado `wfa*.txt`, enviados PDF + `wfa*.txt` a destino WhatsApp y eliminado `wfa*.txt` local tras éxito.
```

---

Notas finales
- El circuito descrito refleja el estado base estable tras “reset” (sin persistencia de impresora). Para activar selección de impresora, incorporar `printerName` (opcional) en `recibo.config.json`, propagarlo en `recibo:save-config` y pasar a `printPdf(localOutPath, printerName, copies)`.


