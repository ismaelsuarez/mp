/**
 * Ventana para Modo Carga (VENTANA=carga)
 */

import { BrowserWindow, ipcMain, app, screen, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import { processFilesToUris } from './CargaProcessor';
import Store from 'electron-store';

type OpenOpts = {
  txtPath: string;
  parsed: { nombre: string; extensions: string[]; uris: string[] };
  filename: string;
};

function getBase() {
  // En producción, los assets viven bajo resources/app; app.getAppPath() apunta ahí
  // En desarrollo, también apunta al root del proyecto
  return app.getAppPath();
}

// Estado persistente de ventana (mismo store que usa el resto de ventanas)
const STATE_KEY = 'imageCargaWindowBounds';
const DEFAULTS = {
  width: 840,
  height: 620,
  minWidth: 800,
  minHeight: 560
} as const;
const MARGIN = 24; // margen visual contra workArea

function getEncryptionKey(): string | undefined {
  try {
    const keyPath = path.join(app.getPath('userData'), 'config.key');
    if (fs.existsSync(keyPath)) return fs.readFileSync(keyPath, 'utf8');
    return undefined;
  } catch { return undefined; }
}

const settings = new Store<{ [k: string]: any }>({ name: 'settings', cwd: (()=>{ try { return app.getPath('userData'); } catch { return undefined; } })(), encryptionKey: getEncryptionKey() });

// Registrar IPC auxiliares una sola vez para no colisionar en aperturas sucesivas
let auxIpcRegistered = false;
function registerAuxCargaIpcOnce() {
  if (auxIpcRegistered) return;
  auxIpcRegistered = true;

  const escapeRegExp = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');

  ipcMain.handle('carga:list-matching', async (_e, payload: { uris: string[]; base: string; ext: string | string[] }) => {
    const { uris, base } = payload || { uris: [], base: '' } as any;
    const exts = Array.isArray((payload as any)?.ext)
      ? (payload as any).ext as string[]
      : [(payload as any)?.ext as string].filter(Boolean);
    const normExts = (exts.length ? exts : ['']).map(e => String(e || '').replace(/^\./, '')).filter(Boolean);
    const rxList = normExts.map(e => new RegExp(`^${escapeRegExp(base)}(?:-(\\d+))?\\.${escapeRegExp(e)}$`, 'i'));
    const results = await Promise.all((uris || []).map(async (dir) => {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        const files = entries
          .filter(d => d.isFile() && (rxList.length ? rxList.some(rx => rx.test(d.name)) : true))
          .map(d => ({ name: d.name, path: path.join(dir, d.name) }));
        let max = 0;
        for (const f of files) {
          for (const rx of rxList) {
            const m = rx.exec(f.name);
            const n = m && (m as any)[1] ? parseInt((m as any)[1], 10) : 0;
            if (n > max) max = n;
          }
        }
        return { dir, exists: true, files, maxSuffix: max };
      } catch (err: any) {
        return { dir, exists: false, files: [], maxSuffix: -1, error: err?.message || String(err) };
      }
    }));
    return results;
  });

  ipcMain.handle('carga:get-next-index', async (_e, payload: { uris: string[]; base: string; ext: string }) => {
    const { uris, base, ext } = payload || { uris: [], base: '', ext: '' };
    const escape = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const rx = new RegExp(`^${escape(base)}(?:-(\\d+))?\\.${escape(ext)}$`, 'i');
    let max = -1;
    const byUri: any[] = [];
    for (const dir of uris || []) {
      try {
        const entries = await fs.promises.readdir(dir, { withFileTypes: true });
        const files = entries.filter(d => d.isFile() && rx.test(d.name)).map(d => d.name);
        let localMax = 0;
        for (const name of files) {
          const m = rx.exec(name);
          const n = m && (m as any)[1] ? parseInt((m as any)[1], 10) : 0;
          if (n > localMax) localMax = n;
        }
        if (localMax > max) max = localMax;
        byUri.push({ dir, exists: true, files, maxSuffix: localMax });
      } catch (err: any) {
        byUri.push({ dir, exists: false, files: [], maxSuffix: -1, error: err?.message || String(err) });
      }
    }
    return { nextIndex: Math.max(0, max + 1), byUri };
  });

  ipcMain.handle('carga:open-folder', async (_e, dir: string) => {
    try {
      if (fs.existsSync(dir)) {
        await shell.openPath(dir);
        return { ok: true };
      }
      return { ok: false, message: 'El directorio no existe.' };
    } catch (e: any) {
      return { ok: false, message: e?.message || String(e) };
    }
  });

  ipcMain.handle('carga:open-file', async (_e, filePath: string) => {
    try {
      if (fs.existsSync(filePath)) {
        const res = await shell.openPath(filePath);
        return { ok: !res, message: res || undefined };
      }
      return { ok: false, message: 'El archivo no existe.' };
    } catch (e: any) {
      return { ok: false, message: e?.message || String(e) };
    }
  });
}

function clampToWorkArea(b: Electron.Rectangle, d: Electron.Display) {
  const wa = d.workArea;
  const minW = DEFAULTS.minWidth!, minH = DEFAULTS.minHeight!;
  const width  = Math.min(Math.max(b.width,  minW), Math.max(wa.width  - MARGIN, minW));
  const height = Math.min(Math.max(b.height, minH), Math.max(wa.height - MARGIN, minH));
  let x = b.x, y = b.y;
  if (x < wa.x) x = wa.x;
  if (y < wa.y) y = wa.y;
  if (x + width  > wa.x + wa.width)  x = wa.x + wa.width  - width;
  if (y + height > wa.y + wa.height) y = wa.y + wa.height - height;
  return { x: Math.round(x), y: Math.round(y), width: Math.round(width), height: Math.round(height) };
}

function loadState() {
  try { return (settings.get(STATE_KEY) as any) || null; } catch { return null; }
}
function saveState(win: BrowserWindow) {
  try {
    const b = win.getBounds();
    const d = screen.getDisplayMatching(b);
    const payload = {
      x: b.x, y: b.y, width: b.width, height: b.height,
      maximized: win.isMaximized(),
      displayId: d?.id,
      work: d?.workArea // para escalar si cambió la resolución
    };
    settings.set(STATE_KEY, payload);
  } catch {}
}

function computeInitialBounds() {
  const displays = screen.getAllDisplays();
  const primary  = screen.getPrimaryDisplay();
  const state = loadState();

  if (state && Number.isFinite(state.x) && Number.isFinite(state.y) && state.width && state.height) {
    // Elegir el display guardado o el que mejor calce
    let target = (state.displayId !== undefined)
      ? displays.find(d => d.id === state.displayId)
      : screen.getDisplayMatching({ x: state.x, y: state.y, width: state.width, height: state.height });
    if (!target) target = primary;

    // Escalado relativo si cambió la resolución desde que se guardó
    const wa = target.workArea;
    const baseW = state.work?.width  ?? wa.width;
    const baseH = state.work?.height ?? wa.height;
    const baseX = state.work?.x ?? wa.x;
    const baseY = state.work?.y ?? wa.y;

    const scaleX = baseW ? wa.width  / baseW : 1;
    const scaleY = baseH ? wa.height / baseH : 1;

    const x = wa.x + Math.round((state.x - baseX) * scaleX);
    const y = wa.y + Math.round((state.y - baseY) * scaleY);
    const w = Math.max(DEFAULTS.minWidth!,  Math.round(state.width  * scaleX));
    const h = Math.max(DEFAULTS.minHeight!, Math.round(state.height * scaleY));

    const clamped = clampToWorkArea({ x, y, width: w, height: h }, target);
    return { bounds: clamped, maximized: !!state.maximized };
  }

  // Fallback: centrar en primario
  const wa = primary.workArea;
  const w = Math.max(DEFAULTS.minWidth!,  Math.min(DEFAULTS.width,  wa.width  - MARGIN));
  const h = Math.max(DEFAULTS.minHeight!, Math.min(DEFAULTS.height, wa.height - MARGIN));
  const x = wa.x + Math.round((wa.width  - w) / 2);
  const y = wa.y + Math.round((wa.height - h) / 2);
  const clamped = clampToWorkArea({ x, y, width: w, height: h }, primary);
  return { bounds: clamped, maximized: false };
}

function ensureVisible(win: BrowserWindow) {
  try {
    const b = win.getBounds();
    const d = screen.getDisplayMatching(b);
    const wa = d.workArea;
    const out =
      b.x < wa.x || b.y < wa.y ||
      b.x + b.width  > wa.x + wa.width ||
      b.y + b.height > wa.y + wa.height;
    if (out) {
      const { bounds } = computeInitialBounds();
      win.setBounds(bounds);
    }
  } catch {}
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

    // Asegurar IPC auxiliares registrados una sola vez
    registerAuxCargaIpcOnce();

    const init = computeInitialBounds();

    const win = new BrowserWindow({
      x: init.bounds.x,
      y: init.bounds.y,
      width: init.bounds.width,
      height: init.bounds.height,
      minWidth: DEFAULTS.minWidth,
      minHeight: DEFAULTS.minHeight,
      useContentSize: true,
      show: false,
      frame: true,
      resizable: true,
      maximizable: true,
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

    ipcMain.once('carga:process', async (_event, payload: { files: { realPath: string; targetName: string }[]; mode?: 'overwrite' | 'skip' }) => {
      try {
        const mode = payload?.mode === 'skip' ? 'skip' : 'overwrite';
        await processFilesToUris(payload.files, opts.parsed.uris, mode);
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

    // IPC auxiliares ya registrados globalmente por registerAuxCargaIpcOnce()

    // Guardado de state (debounce para evitar escribir en cada pixel)
    let t: NodeJS.Timeout | null = null;
    const queueSave = () => {
      if (t) clearTimeout(t);
      t = setTimeout(() => { if (!win.isDestroyed()) saveState(win); }, 160);
    };
    win.on('move', queueSave);
    win.on('resize', queueSave);
    win.on('maximize', queueSave);
    win.on('unmaximize', queueSave);

    // Si cambian los monitores en caliente, mantener visible
    const onDisplays = () => ensureVisible(win);
    screen.on('display-added', onDisplays);
    screen.on('display-removed', onDisplays);
    screen.on('display-metrics-changed', onDisplays);

    win.on('closed', () => {
      try { saveState(win); } catch {}
      screen.off('display-added', onDisplays);
      screen.off('display-removed', onDisplays);
      screen.off('display-metrics-changed', onDisplays);
      console.log('[carga] Ventana cerrada');
      resolve();
    });

    // Cargar HTML
    const htmlPath = path.join(base, 'public', 'carga.html');
    console.log('[carga] Cargando HTML desde:', htmlPath);
    
    win.loadFile(htmlPath).then(() => {
      console.log('[carga] HTML cargado, mostrando ventana...');
      if (init.maximized) try { win.maximize(); } catch {}
      try { win.show(); win.focus(); } catch {}
      // Enviar init después de mostrar
      setTimeout(pushInit, 500);
    }).catch((err) => {
      console.error('[carga] ❌ Error al cargar HTML:', err);
    });
  });
}

