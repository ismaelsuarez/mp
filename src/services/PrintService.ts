import { BrowserWindow } from 'electron';
import path from 'path';

/**
 * Imprime un PDF de forma silenciosa a la impresora indicada.
 * Crea una ventana oculta temporalmente, carga el PDF local y dispara print.
 */
export async function printPdf(filePath: string, printerName?: string, copies: number = 1): Promise<void> {
  if (!filePath) return;
  const win = new BrowserWindow({
    show: false,
    webPreferences: {
      sandbox: false,
      backgroundThrottling: false,
    },
  });

  try {
    // Cargar visor integrado de PDF de Chromium
    const url = 'file://' + path.resolve(filePath).replace(/\\/g, '/');
    await win.loadURL(url);
    await new Promise((r) => setTimeout(r, 500));
    await new Promise<void>((resolve) => {
      win.webContents.print({
        silent: true,
        deviceName: printerName || undefined,
        copies: Math.max(1, Math.floor(copies || 1)),
        printBackground: true,
      }, (success, failureReason) => {
        try { /* noop */ } catch {}
        resolve();
      });
    });
  } finally {
    try { win.close(); } catch {}
  }
}


