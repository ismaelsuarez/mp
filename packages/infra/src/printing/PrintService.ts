/**
 * @infra/printing - Wrapper de pdf-to-printer para impresión silenciosa
 * 
 * Enviamos el PDF directamente al spooler del SO usando pdf-to-printer
 * para evitar el bug de "página negra" en webContents.print.
 */
import { print as printNative } from 'pdf-to-printer';
import path from 'path';
import { cajaLog } from '../../../../src/services/CajaLogService';

// Logs de depuración opcionales (habilitar con PRINT_DEBUG=1)
const DEBUG_PRINT = process.env.PRINT_DEBUG === '1';

// Nota: pdf-to-printer debe estar instalada. Si no está, arrojamos un error claro.

/**
 * Imprime un PDF de forma silenciosa a la impresora indicada.
 * Crea una ventana oculta temporalmente, carga el PDF local y dispara print.
 */
export async function printPdf(filePath: string, printerName?: string, copies: number = 1): Promise<void> {
  // API pública intacta
  if (!filePath) return;
  const abs = path.resolve(filePath);
  if (DEBUG_PRINT) console.log('[PrintService] pdf-to-printer print', { filePath: abs, printerName, copies });

  // Verificación básica de la ruta
  try {
    const fs = require('fs');
    const st = fs.statSync(abs);
    if (!st || st.size <= 0) throw new Error('PDF vacío o inaccesible');
  } catch (e) {
    if (DEBUG_PRINT) console.error('[PrintService] archivo no válido', e);
    throw e;
  }

  // Impresión directa al spooler del SO (evita motor de render de Electron/Chromium)
  const fileName = path.basename(abs);
  const numCopies = Math.max(1, Math.floor(copies || 1));
  
  try {
    await printNative(abs, {
      printer: printerName || undefined,
      copies: numCopies,
    } as any);
    
    // Log exitoso
    cajaLog.logImpresion(numCopies, printerName);
    
  } catch (err: any) {
    // Mensaje claro si falta la librería
    const msg = String(err?.message || err);
    if (/Cannot find module 'pdf-to-printer'/.test(msg)) {
      cajaLog.logImpresionError('Falta dependencia pdf-to-printer');
      throw new Error('Falta la dependencia pdf-to-printer. Ejecute: npm install pdf-to-printer');
    }
    if (DEBUG_PRINT) console.error('[PrintService] error pdf-to-printer', msg);
    
    // Log de error
    cajaLog.logImpresionError(msg);
    throw err;
  }
}

/**
 * Alternativa (opcional): generar buffer con printToPDF y enviar al spooler nativo.
 * - Útil si el driver sigue produciendo "página negra".
 * - Por defecto NO se usa. Para habilitarla, reemplazar el uso de printPdf por printPdfWithBuffer
 *   o agregar una bandera de configuración en tiempo de ejecución.
 *
 * Notas:
 * - Aquí se escribe un archivo temporal y se delega a pdf-to-printer si está disponible.
 * - En Windows, también puede llamarse a utilitarios del SO; p. ej., "print" o integraciones con PowerShell.
 */
export async function printPdfWithBuffer(filePath: string, printerName?: string, copies: number = 1): Promise<void> {
  if (!filePath) return;
  const { BrowserWindow } = require('electron');
  const fs = require('fs');
  const os = require('os');
  const win = new BrowserWindow({ show: false, webPreferences: { sandbox: false, backgroundThrottling: false } });

  let tmpFile: string | null = null;
  try {
    const url = 'file://' + path.resolve(filePath).replace(/\\/g, '/');
    if (DEBUG_PRINT) console.log('[PrintService] loadURL (buffer mode)', url);
    await new Promise<void>((resolve) => {
      const onDone = () => resolve();
      win.webContents.once('did-finish-load', onDone);
      win.webContents.once('did-fail-load', onDone);
      win.loadURL(url).catch(onDone);
    });
    // Mismo criterio: dar tiempo al render
    await new Promise((r) => setTimeout(r, 2000));

    // Obtener buffer PDF con fondo/imagenes ya resueltos
    const buffer = await win.webContents.printToPDF({
      printBackground: true,
      margins: { marginType: 'none' as any },
    } as any);

    // Escribir archivo temporal para enviarlo al driver nativo
    const base = path.join(os.tmpdir(), `mp-print-${Date.now()}-${Math.random().toString(36).slice(2)}.pdf`);
    fs.writeFileSync(base, buffer);
    tmpFile = base;

    // Enviar al spooler nativo usando pdf-to-printer (multiplataforma)
    const numCopies = Math.max(1, Math.floor(copies || 1));
    await printNative(base, { printer: printerName || undefined, copies: numCopies } as any);
  } finally {
    try { win.close(); } catch {}
    if (tmpFile) {
      try { fs.unlinkSync(tmpFile); } catch {}
    }
  }
}


