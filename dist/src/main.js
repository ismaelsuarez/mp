"use strict";
var __createBinding = (this && this.__createBinding) || (Object.create ? (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    var desc = Object.getOwnPropertyDescriptor(m, k);
    if (!desc || ("get" in desc ? !m.__esModule : desc.writable || desc.configurable)) {
      desc = { enumerable: true, get: function() { return m[k]; } };
    }
    Object.defineProperty(o, k2, desc);
}) : (function(o, m, k, k2) {
    if (k2 === undefined) k2 = k;
    o[k2] = m[k];
}));
var __setModuleDefault = (this && this.__setModuleDefault) || (Object.create ? (function(o, v) {
    Object.defineProperty(o, "default", { enumerable: true, value: v });
}) : function(o, v) {
    o["default"] = v;
});
var __importStar = (this && this.__importStar) || (function () {
    var ownKeys = function(o) {
        ownKeys = Object.getOwnPropertyNames || function (o) {
            var ar = [];
            for (var k in o) if (Object.prototype.hasOwnProperty.call(o, k)) ar[ar.length] = k;
            return ar;
        };
        return ownKeys(o);
    };
    return function (mod) {
        if (mod && mod.__esModule) return mod;
        var result = {};
        if (mod != null) for (var k = ownKeys(mod), i = 0; i < k.length; i++) if (k[i] !== "default") __createBinding(result, mod, k[i]);
        __setModuleDefault(result, mod);
        return result;
    };
})();
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
const path_1 = __importDefault(require("path"));
const fs_1 = __importDefault(require("fs"));
const crypto_1 = __importDefault(require("crypto"));
const electron_store_1 = __importDefault(require("electron-store"));
const MercadoPagoService_1 = require("./services/MercadoPagoService");
const ReportService_1 = require("./services/ReportService");
const FtpService_1 = require("./services/FtpService");
const EmailService_1 = require("./services/EmailService");
const LogService_1 = require("./services/LogService");
let mainWindow = null;
function getEncryptionKey() {
    const dir = electron_1.app.getPath('userData');
    const keyPath = path_1.default.join(dir, 'config.key');
    try {
        if (fs_1.default.existsSync(keyPath)) {
            return fs_1.default.readFileSync(keyPath, 'utf8');
        }
        const key = crypto_1.default.randomBytes(32).toString('hex');
        fs_1.default.writeFileSync(keyPath, key, { mode: 0o600 });
        return key;
    }
    catch (e) {
        return undefined;
    }
}
const store = new electron_store_1.default({ name: 'settings', encryptionKey: getEncryptionKey() });
function createMainWindow() {
    mainWindow = new electron_1.BrowserWindow({
        width: 1000,
        height: 700,
        webPreferences: {
            preload: path_1.default.join(__dirname, 'preload.js'),
            contextIsolation: true,
            nodeIntegration: false,
            devTools: true
        }
    });
    // En build, __dirname apunta a dist/src; public queda al lado de dist
    const cfg = store.get('config') || {};
    let defaultView = cfg?.DEFAULT_VIEW === 'config' ? 'config' : 'caja';
    // Siempre preferir iniciar en "caja" (sin forzar ir a configuracion por falta de token)
    const initialFile = (defaultView ?? 'caja') === 'caja' ? 'caja.html' : 'config.html';
    // Ajustar visibilidad de menú y tamaño acorde a la vista inicial
    try {
        if (defaultView === 'caja') {
            // Tamaño compacto como la captura
            mainWindow.setMinimumSize(420, 320);
            mainWindow.setSize(420, 320);
            mainWindow.setMenuBarVisibility(false);
            mainWindow.setAutoHideMenuBar(true);
            try {
                mainWindow.center();
            }
            catch { }
        }
        else {
            // Modo Configuración: tamaño amplio como en la captura
            mainWindow.setMinimumSize(900, 600);
            mainWindow.setSize(1200, 768);
            // Ocultar menú también en Configuración
            mainWindow.setMenuBarVisibility(false);
            mainWindow.setAutoHideMenuBar(true);
            // Centrar la ventana cuando se abre Configuración
            try {
                mainWindow.center();
            }
            catch { }
        }
    }
    catch { }
    const htmlPath = path_1.default.join(electron_1.app.getAppPath(), 'public', initialFile);
    mainWindow.loadFile(htmlPath);
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
// Desactivar aceleración por GPU (mejora compatibilidad en WSL/VMs)
electron_1.app.disableHardwareAcceleration();
electron_1.app.whenReady().then(() => {
    (0, LogService_1.ensureLogsDir)();
    // IPC seguro para configuración
    electron_1.ipcMain.handle('get-config', () => {
        return store.get('config') || {};
    });
    electron_1.ipcMain.handle('save-config', (_event, cfg) => {
        if (cfg && typeof cfg === 'object') {
            store.set('config', cfg);
            return true;
        }
        return false;
    });
    electron_1.ipcMain.handle('test-connection', async () => {
        return await (0, MercadoPagoService_1.testConnection)();
    });
    // Generar reporte bajo demanda
    electron_1.ipcMain.handle('generate-report', async () => {
        (0, LogService_1.appendLogLine)('generate-report invoked');
        const { payments, range } = await (0, MercadoPagoService_1.searchPaymentsWithConfig)();
        const tag = new Date().toISOString().slice(0, 10);
        const result = await (0, ReportService_1.generateFiles)(payments, tag, range);
        (0, LogService_1.appendLogLine)('files-generated', { files: result?.files, count: payments?.length });
        if (mainWindow)
            mainWindow.webContents.send('auto-report-notice', { info: 'Enviando mp.dbf por FTP…' });
        // Auto-enviar mp.dbf vía FTP si está configurado
        try {
            const mpPath = result?.files?.mpDbfPath;
            if (mpPath && fs_1.default.existsSync(mpPath)) {
                await (0, FtpService_1.sendDbf)(mpPath, 'mp.dbf');
            }
        }
        catch (e) {
            console.warn('[main] auto FTP send failed:', e);
            if (mainWindow)
                mainWindow.webContents.send('auto-report-notice', { error: `FTP: ${String(e?.message || e)}` });
        }
        // Reducir payload para UI y notificar a Caja
        const uiRows = payments.slice(0, 1000).map((p) => ({
            id: p?.id,
            status: p?.status,
            amount: p?.transaction_amount,
            date: p?.date_created,
            method: p?.payment_method_id
        }));
        if (mainWindow) {
            const rowsShort = uiRows.slice(0, 8);
            mainWindow.webContents.send('auto-report-notice', { manual: true, count: payments.length, rows: rowsShort });
        }
        return { count: payments.length, outDir: result.outDir, files: result.files, rows: uiRows };
    });
    // Export on-demand without re-fetch (assumes files already generated or uses latest payments)
    electron_1.ipcMain.handle('export-report', async () => {
        const outDir = (0, ReportService_1.getOutDir)();
        return { outDir };
    });
    electron_1.ipcMain.handle('send-report-email', async () => {
        const today = new Date().toISOString().slice(0, 10);
        const outDir = (0, ReportService_1.getOutDir)();
        const files = [
            { filename: `balance-${today}.json`, path: `${outDir}/balance-${today}.json` },
            { filename: `transactions-${today}.csv`, path: `${outDir}/transactions-${today}.csv` },
            { filename: `transactions-full-${today}.csv`, path: `${outDir}/transactions-full-${today}.csv` },
            { filename: `transactions-full-${today}.xlsx`, path: `${outDir}/transactions-full-${today}.xlsx` },
            { filename: `transactions-detailed-${today}.dbf`, path: `${outDir}/transactions-detailed-${today}.dbf` }
        ].filter(f => fs_1.default.existsSync(f.path));
        const sent = await (0, EmailService_1.sendReportEmail)(`MP Reporte ${today}`, `Adjunto reporte de ${today}`, files);
        return { sent, files: files.map((f) => f.filename) };
    });
    // FTP: probar conexión
    electron_1.ipcMain.handle('test-ftp', async () => {
        try {
            const ok = await (0, FtpService_1.testFtp)();
            return { ok };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    // FTP: enviar DBF del día
    electron_1.ipcMain.handle('send-dbf-ftp', async () => {
        try {
            const res = await (0, FtpService_1.sendTodayDbf)();
            return { ok: true, ...res };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    // Abrir carpeta de salida
    electron_1.ipcMain.handle('open-out-dir', async () => {
        const dir = (0, ReportService_1.getOutDir)();
        await electron_1.shell.openPath(dir);
        return { ok: true, dir };
    });
    // Abrir log del día
    electron_1.ipcMain.handle('open-today-log', async () => {
        const p = (0, LogService_1.getTodayLogPath)();
        try {
            await electron_1.shell.openPath(p);
            return { ok: true, path: p };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e), path: p };
        }
    });
    // Listar historial simple por fecha (tags)
    electron_1.ipcMain.handle('list-history', async () => {
        const dir = (0, ReportService_1.getOutDir)();
        try {
            const entries = fs_1.default.existsSync(dir) ? fs_1.default.readdirSync(dir) : [];
            const map = new Map();
            for (const name of entries) {
                const m = name.match(/^(balance|transactions|transactions-full|transactions-detailed)-([0-9]{4}-[0-9]{2}-[0-9]{2})\.(json|csv|xlsx|dbf)$/);
                if (!m)
                    continue;
                const tag = m[2];
                const arr = map.get(tag) || [];
                arr.push(name);
                map.set(tag, arr);
            }
            const items = Array.from(map.entries()).sort((a, b) => a[0] < b[0] ? 1 : -1).map(([tag, files]) => ({ tag, files }));
            return { ok: true, dir, items };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    // Abrir vistas (config/caja)
    electron_1.ipcMain.handle('open-view', async (_evt, view) => {
        const file = view === 'caja' ? 'caja.html' : 'config.html';
        console.log('[main] open-view →', view, '->', file);
        if (mainWindow) {
            const target = path_1.default.join(electron_1.app.getAppPath(), 'public', file);
            console.log('[main] loading file:', target);
            // Ajustar tamaño según vista
            try {
                if (view === 'caja') {
                    mainWindow.setMinimumSize(420, 320);
                    mainWindow.setSize(420, 320);
                    mainWindow.setMenuBarVisibility(false);
                    mainWindow.setAutoHideMenuBar(true);
                    try {
                        mainWindow.center();
                    }
                    catch { }
                }
                else {
                    mainWindow.setMinimumSize(900, 600);
                    mainWindow.setSize(1200, 768);
                    // Ocultar menú en Configuración
                    mainWindow.setMenuBarVisibility(false);
                    mainWindow.setAutoHideMenuBar(true);
                    // Centrar la ventana al abrir Configuración
                    try {
                        mainWindow.center();
                    }
                    catch { }
                }
            }
            catch { }
            await mainWindow.loadFile(target);
            console.log('[main] loadFile done');
            return { ok: true };
        }
        console.warn('[main] open-view: no mainWindow');
        return { ok: false };
    });
    // Cambiar tamaño de ventana actual
    electron_1.ipcMain.handle('set-window-size', async (_evt, payload) => {
        if (!mainWindow)
            return { ok: false };
        const w = Number(payload?.width || 0);
        const h = Number(payload?.height || 0);
        if (w > 0 && h > 0) {
            mainWindow.setSize(w, h);
            return { ok: true };
        }
        return { ok: false };
    });
    createMainWindow();
    // Programación automática
    let autoTimer = null;
    let autoActive = false;
    function stopAutoTimer() {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
        autoActive = false;
    }
    async function startAutoTimer() {
        stopAutoTimer();
        const cfg = store.get('config') || {};
        const intervalSec = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
        if (!Number.isFinite(intervalSec) || intervalSec <= 0)
            return false;
        autoTimer = setInterval(async () => {
            try {
                const { payments, range } = await (0, MercadoPagoService_1.searchPaymentsWithConfig)();
                const tag = new Date().toISOString().slice(0, 10);
                const result = await (0, ReportService_1.generateFiles)(payments, tag, range);
                if (mainWindow)
                    mainWindow.webContents.send('auto-report-notice', { info: 'Enviando mp.dbf por FTP…' });
                try {
                    const mpPath = result?.files?.mpDbfPath;
                    if (mpPath && fs_1.default.existsSync(mpPath)) {
                        const { sendDbf } = await Promise.resolve().then(() => __importStar(require('./services/FtpService')));
                        await sendDbf(mpPath, 'mp.dbf');
                    }
                }
                catch (e) {
                    if (mainWindow)
                        mainWindow.webContents.send('auto-report-notice', { error: `FTP: ${String(e?.message || e)}` });
                }
                if (mainWindow) {
                    const uiRows = payments.slice(0, 1000).map((p) => ({
                        id: p?.id,
                        status: p?.status,
                        amount: p?.transaction_amount,
                        date: p?.date_created,
                        method: p?.payment_method_id
                    }));
                    mainWindow.webContents.send('auto-report-notice', { when: new Date().toISOString(), count: payments.length, rows: uiRows.slice(0, 8) });
                }
            }
            catch (e) {
                if (mainWindow)
                    mainWindow.webContents.send('auto-report-notice', { error: String(e?.message || e) });
            }
        }, Math.max(1000, intervalSec * 1000));
        autoActive = true;
        return true;
    }
    electron_1.ipcMain.handle('auto-start', async () => {
        const ok = await startAutoTimer();
        return { ok };
    });
    electron_1.ipcMain.handle('auto-stop', async () => {
        stopAutoTimer();
        return { ok: true };
    });
    electron_1.ipcMain.handle('auto-status', async () => {
        return { active: autoActive };
    });
    // Opcional: arrancar si estaba configurado
    const cfg0 = store.get('config') || {};
    if (Number(cfg0.AUTO_INTERVAL_SECONDS || 0) > 0) {
        startAutoTimer().catch(() => { });
    }
    electron_1.app.on('activate', () => {
        if (electron_1.BrowserWindow.getAllWindows().length === 0)
            createMainWindow();
    });
});
electron_1.app.on('window-all-closed', () => {
    if (process.platform !== 'darwin') {
        electron_1.app.quit();
    }
});
