/**
 * Ventana para Modo Carga (VENTANA=carga)
 */

import { BrowserWindow, ipcMain, app } from 'electron';
import path from 'path';
import fs from 'fs';
import { processFilesToUris } from './CargaProcessor';

type OpenOpts = {
  txtPath: string;
  parsed: { nombre: string; extension: string; uris: string[] };
  filename: string;
};

function getBase() {
  return app.isPackaged ? process.resourcesPath : app.getAppPath();
}

/**
 * Abre una ventana de carga y espera a que el usuario procese/cancele
 * @returns Promise que resuelve cuando la ventana se cierra
 */
export function openCargaWindow(opts: OpenOpts): Promise<void> {
  return new Promise((resolve) => {
    const base = getBase();
    const preloadPath = path.join(base, 'dist', 'src', 'preload', 'carga.preload.js');
    console.log('[carga] preload:', preloadPath, 'exists:', fs.existsSync(preloadPath));

    const win = new BrowserWindow({
      width: 900,
      height: 620,
      show: false,
      frame: true,
      webPreferences: {
        preload: preloadPath,
        contextIsolation: true,
        nodeIntegration: false,
        sandbox: false  // 🔥 Para obtener File.path en el drop
      }
    });

    console.log('[carga] BrowserWindow creado, cargando HTML...');

    // win.webContents.openDevTools({ mode: 'detach' }); // <- descomentar para ver consola

    // Handshake: si el renderer no pide init en 1200ms, lo empujamos nosotros
    let initPushed = false;
    const pushInit = () => {
      if (!initPushed && !win.isDestroyed()) {
        win.webContents.send('carga:init', opts.parsed);
        initPushed = true;
        console.log('[carga] init enviado por push');
      }
    };

    ipcMain.once('carga:request-init', (e) => {
      if (e.sender !== win.webContents) return;
      if (initPushed) return;
      e.reply('carga:init', opts.parsed);
      initPushed = true;
      console.log('[carga] init respondido por request');
    });

    ipcMain.once('carga:cancel', async () => {
      try {
        await fs.promises.unlink(opts.txtPath);
      } catch {}
      if (!win.isDestroyed()) win.close();
    });

    ipcMain.once('carga:process', async (_event, files: { realPath: string; targetName: string }[]) => {
      try {
        await processFilesToUris(files, opts.parsed.uris);
        try {
          await fs.promises.unlink(opts.txtPath);
        } catch {}
        win.webContents.send('carga:done', { ok: true, ms: 2000 });
        console.log('[carga] Procesado exitosamente');
      } catch (err: any) {
        console.error('[carga] Error al procesar:', err);
        win.webContents.send('carga:error', { message: err?.message || String(err) });
      }
    });

    win.on('closed', () => {
      console.log('[carga] Ventana cerrada');
      resolve();
    });

    // Cargar HTML
    const htmlPath = path.join(base, 'public', 'carga.html');
    console.log('[carga] Cargando HTML desde:', htmlPath);
    
    win.loadFile(htmlPath).then(() => {
      console.log('[carga] HTML cargado, mostrando ventana...');
      win.show();
      win.focus();
      console.log('[carga] ✅ Ventana mostrada y enfocada');
      
      // Enviar init después de mostrar
      setTimeout(pushInit, 500);
    }).catch((err) => {
      console.error('[carga] ❌ Error al cargar HTML:', err);
    });
  });
}

