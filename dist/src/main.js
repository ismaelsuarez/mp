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
const electron_updater_1 = require("electron-updater");
const dotenv_1 = __importDefault(require("dotenv"));
dotenv_1.default.config();
const MercadoPagoService_1 = require("./services/MercadoPagoService");
const FtpServerService_1 = require("./services/FtpServerService");
const ReportService_1 = require("./services/ReportService");
const FtpService_1 = require("./services/FtpService");
const EmailService_1 = require("./services/EmailService");
const LogService_1 = require("./services/LogService");
const ErrorNotificationService_1 = require("./services/ErrorNotificationService");
const AuthService_1 = require("./services/AuthService");
const OtpService_1 = require("./services/OtpService");
const licencia_1 = require("./utils/licencia");
const DbService_1 = require("./services/DbService");
const FacturacionService_1 = require("./services/FacturacionService");
const afipService_1 = require("./modules/facturacion/afipService");
const ProvinciaManager_1 = require("./modules/facturacion/provincia/ProvinciaManager");
const GaliciaService_1 = require("./services/GaliciaService");
let mainWindow = null;
let tray = null;
let isQuitting = false;
let currentViewName = 'caja';
// Ventana persistente para presentaciones (comun12)
let imageDualWindow = null;
// Ventana 'nueva' (reutilizable bajo política de Producto Nuevo)
let lastImageNewWindow = null;
let lastImageNewWindowAt = 0; // epoch ms
// Publicidad (presentación pantalla completa) para ventana espejo
function isPublicidadAllowed() {
    try {
        const cfg = store.get('config') || {};
        return cfg.IMAGE_PUBLICIDAD_ALLOWED === true;
    }
    catch {
        return false;
    }
}
function isPublicidadActive() {
    try {
        return isPublicidadAllowed() && (store.get('publicidadOn') === true);
    }
    catch {
        return false;
    }
}
function setPublicidadActive(on) {
    try {
        store.set('publicidadOn', !!on);
    }
    catch { }
    try {
        refreshTrayMenu();
    }
    catch { }
    // Aplicar al vuelo sobre la ventana espejo si existe
    try {
        if (imageDualWindow && !imageDualWindow.isDestroyed()) {
            const active = isPublicidadActive();
            try {
                imageDualWindow.setFullScreenable(true);
            }
            catch { }
            if (active) {
                try {
                    imageDualWindow.setKiosk(true);
                }
                catch { }
                try {
                    imageDualWindow.setAlwaysOnTop(true, 'screen-saver');
                }
                catch { }
                try {
                    imageDualWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
                }
                catch { }
                try {
                    imageDualWindow.setFullScreen(true);
                }
                catch { }
            }
            else {
                try {
                    imageDualWindow.setKiosk(false);
                }
                catch { }
                try {
                    imageDualWindow.setAlwaysOnTop(false);
                }
                catch { }
                try {
                    imageDualWindow.setVisibleOnAllWorkspaces(false);
                }
                catch { }
                try {
                    imageDualWindow.setFullScreen(false);
                }
                catch { }
            }
            try {
                imageDualWindow.webContents.send('image:publicidad-mode', { on: active });
            }
            catch { }
        }
    }
    catch { }
}
// Guardar tamaño/posición de la ventana secundaria (comun12)
function saveImageDualWindowBounds() {
    try {
        if (!imageDualWindow)
            return;
        const bounds = imageDualWindow.getBounds();
        const display = electron_1.screen.getDisplayMatching(bounds);
        const work = display.workArea || display.bounds;
        store.set('imageDualWindowBounds', {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            workW: work.width,
            workH: work.height,
            workX: work.x,
            workY: work.y,
            displayId: display.id
        });
        // Guardar también si estaba maximizada
        try {
            store.set('imageDualWindowMaximized', !!imageDualWindow.isMaximized());
        }
        catch { }
    }
    catch { }
}
function restoreImageDualWindowBounds(win, minWidth = 420, minHeight = 420) {
    try {
        const saved = store.get('imageDualWindowBounds');
        if (!saved || saved.x === undefined || saved.y === undefined || !saved.width || !saved.height)
            return false;
        const displays = electron_1.screen.getAllDisplays();
        let target = saved.displayId !== undefined ? displays.find(d => d.id === saved.displayId) : undefined;
        if (!target) {
            // fallback: buscar por área donde estaba; si no, primario
            target = electron_1.screen.getDisplayMatching({ x: saved.x, y: saved.y, width: saved.width, height: saved.height }) || electron_1.screen.getPrimaryDisplay();
        }
        const work = target.workArea || target.bounds;
        const baseW = saved.workW && saved.workW > 0 ? saved.workW : work.width;
        const baseH = saved.workH && saved.workH > 0 ? saved.workH : work.height;
        const baseX = saved.workX !== undefined ? saved.workX : work.x;
        const baseY = saved.workY !== undefined ? saved.workY : work.y;
        const scaleX = baseW > 0 ? work.width / baseW : 1;
        const scaleY = baseH > 0 ? work.height / baseH : 1;
        const offsetX = saved.x - baseX;
        const offsetY = saved.y - baseY;
        let x = work.x + Math.round(offsetX * scaleX);
        let y = work.y + Math.round(offsetY * scaleY);
        let w = Math.max(minWidth, Math.round(saved.width * scaleX));
        let h = Math.max(minHeight, Math.round(saved.height * scaleY));
        // Clamp dentro del workArea del monitor destino
        x = Math.max(work.x, Math.min(x, work.x + work.width - minWidth));
        y = Math.max(work.y, Math.min(y, work.y + work.height - minHeight));
        win.setBounds({ x, y, width: w, height: h });
        // Aplicar estado maximizado previo si existía y no está en modo publicidad
        try {
            const wasMax = store.get('imageDualWindowMaximized') === true;
            if (wasMax && !isPublicidadActive())
                win.maximize();
        }
        catch { }
        return true;
    }
    catch {
        return false;
    }
}
// Persistencia para ventanas creadas con VENTANA=nueva
function saveImageNewWindowBounds(win) {
    try {
        if (!win)
            return;
        const bounds = win.getBounds();
        const display = electron_1.screen.getDisplayMatching(bounds);
        const work = display.workArea || display.bounds;
        store.set('imageNewWindowBounds', {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            workW: work.width,
            workH: work.height,
            workX: work.x,
            workY: work.y,
            displayId: display.id
        });
    }
    catch { }
}
function restoreImageNewWindowBounds(win, minWidth = 420, minHeight = 420) {
    try {
        const saved = store.get('imageNewWindowBounds');
        if (!saved || saved.x === undefined || saved.y === undefined || !saved.width || !saved.height)
            return false;
        const displays = electron_1.screen.getAllDisplays();
        let target = saved.displayId !== undefined ? displays.find(d => d.id === saved.displayId) : undefined;
        if (!target) {
            target = electron_1.screen.getDisplayMatching({ x: saved.x, y: saved.y, width: saved.width, height: saved.height }) || electron_1.screen.getPrimaryDisplay();
        }
        const work = target.workArea || target.bounds;
        const baseW = saved.workW && saved.workW > 0 ? saved.workW : work.width;
        const baseH = saved.workH && saved.workH > 0 ? saved.workH : work.height;
        const baseX = saved.workX !== undefined ? saved.workX : work.x;
        const baseY = saved.workY !== undefined ? saved.workY : work.y;
        const scaleX = baseW > 0 ? work.width / baseW : 1;
        const scaleY = baseH > 0 ? work.height / baseH : 1;
        const offsetX = saved.x - baseX;
        const offsetY = saved.y - baseY;
        let x = work.x + Math.round(offsetX * scaleX);
        let y = work.y + Math.round(offsetY * scaleY);
        let w = Math.max(minWidth, Math.round(saved.width * scaleX));
        let h = Math.max(minHeight, Math.round(saved.height * scaleY));
        x = Math.max(work.x, Math.min(x, work.x + work.width - minWidth));
        y = Math.max(work.y, Math.min(y, work.y + work.height - minHeight));
        win.setBounds({ x, y, width: w, height: h });
        return true;
    }
    catch {
        return false;
    }
}
// Limpia artefactos previos del updater que pueden producir EPERM al renombrar
function cleanupUpdaterPendingDir() {
    try {
        if (process.platform !== 'win32')
            return;
        const local = process.env.LOCALAPPDATA;
        if (!local)
            return;
        const pendingDir = path_1.default.join(local, 'tc-mp-updater', 'pending');
        if (!fs_1.default.existsSync(pendingDir))
            return;
        const files = fs_1.default.readdirSync(pendingDir);
        for (const f of files) {
            try {
                const lower = f.toLowerCase();
                if (lower.endsWith('.exe') || lower.endsWith('.zip') || lower.includes('tc-mp')) {
                    fs_1.default.rmSync(path_1.default.join(pendingDir, f), { force: true });
                }
            }
            catch { }
        }
    }
    catch { }
}
function getTrayImage() {
    try {
        const candidates = [
            // Preferir icono del ejecutable en Windows (suele existir y verse bien)
            process.platform === 'win32' ? process.execPath : '',
            // Icono provisto por el proyecto
            path_1.default.join(electron_1.app.getAppPath(), 'build', 'icon.ico'),
            path_1.default.join(electron_1.app.getAppPath(), 'public', 'icon.png'),
            path_1.default.join(electron_1.app.getAppPath(), 'public', 'icon.ico'),
            path_1.default.join(electron_1.app.getAppPath(), 'icon.png'),
            path_1.default.join(process.resourcesPath || '', 'icon.png'),
            path_1.default.join(process.resourcesPath || '', 'build', 'icon.ico')
        ];
        for (const p of candidates) {
            try {
                if (!p)
                    continue;
                let img = electron_1.nativeImage.createFromPath(p);
                if (!img.isEmpty()) {
                    // Ajustar tamaño para bandeja en Windows para evitar icono invisible/borroso
                    if (process.platform === 'win32') {
                        img = img.resize({ width: 16, height: 16 });
                    }
                    return img;
                }
            }
            catch { }
        }
        // Último recurso: usar icono del proceso (no siempre disponible) o un vacío
        const procImg = electron_1.nativeImage.createFromPath(process.execPath);
        if (!procImg.isEmpty()) {
            return process.platform === 'win32' ? procImg.resize({ width: 16, height: 16 }) : procImg;
        }
        return electron_1.nativeImage.createEmpty();
    }
    catch {
        return electron_1.nativeImage.createEmpty();
    }
}
async function openViewFromTray(view) {
    if (!mainWindow)
        return;
    // Asegurar que la ventana esté visible (fuera de bandeja) antes de cambiar la vista
    showMainWindow();
    if (view === 'config') {
        currentViewName = 'config';
        store.set('lastView', 'config');
        const target = path_1.default.join(electron_1.app.getAppPath(), 'public', 'auth.html');
        try {
            mainWindow.setMinimumSize(500, 400);
            mainWindow.setSize(500, 400);
            mainWindow.setMenuBarVisibility(false);
            mainWindow.setAutoHideMenuBar(true);
            try {
                mainWindow.center();
            }
            catch { }
        }
        catch { }
        await mainWindow.loadFile(target);
        return;
    }
    else if (view === 'caja') {
        // caja
        currentViewName = 'caja';
        store.set('lastView', 'caja');
        const target = path_1.default.join(electron_1.app.getAppPath(), 'public', 'caja.html');
        try {
            mainWindow.setMinimumSize(420, 320);
            // Restaurar posición previa; si no existe, usar tamaño mínimo y centrar
            if (!restoreCajaWindowPosition(420, 320)) {
                mainWindow.setSize(420, 320);
                try {
                    mainWindow.center();
                }
                catch { }
            }
            mainWindow.setMenuBarVisibility(false);
            mainWindow.setAutoHideMenuBar(true);
        }
        catch { }
        await mainWindow.loadFile(target);
    }
    else if (view === 'imagen') {
        // imagen
        currentViewName = 'imagen';
        store.set('lastView', 'imagen');
        const target = path_1.default.join(electron_1.app.getAppPath(), 'public', 'imagen.html');
        try {
            mainWindow.setMinimumSize(420, 420);
            // Intentar restaurar tamaño/posición previo de imagen; si no, usar 420x420 centrado
            if (!restoreImagenWindowBounds(420, 420)) {
                mainWindow.setSize(420, 420);
                try {
                    mainWindow.center();
                }
                catch { }
            }
            mainWindow.setMenuBarVisibility(false);
            mainWindow.setAutoHideMenuBar(true);
        }
        catch { }
        // Cargar contenido y mostrar cuando esté listo (optimización para evitar flickering)
        await mainWindow.loadFile(target);
    }
}
function showMainWindow() {
    if (!mainWindow)
        return;
    try {
        mainWindow.setSkipTaskbar(false);
    }
    catch { }
    mainWindow.show();
    mainWindow.focus();
}
function hideToTray() {
    if (!mainWindow)
        return;
    try {
        mainWindow.setSkipTaskbar(true);
    }
    catch { }
    mainWindow.hide();
}
function buildTrayMenu() {
    const publicidadAllowed = isPublicidadAllowed();
    const publicidadChecked = isPublicidadActive();
    const cfg = store.get('config') || {};
    const activePerms = cfg.ACTIVE_PERFIL_PERMISOS || {};
    const perfilNombre = String(cfg.ACTIVE_PERFIL_NOMBRE || '');
    const cajaDisabled = activePerms && activePerms.caja === false;
    const estadoLabel = perfilNombre ? `Perfil: ${perfilNombre}` : 'Perfil: (sin aplicar)';
    const template = [
        { label: estadoLabel, enabled: false },
        { type: 'separator' },
        { label: 'Mostrar', click: () => showMainWindow() },
        { type: 'separator' },
        { label: perfilNombre ? `Ir a Caja${cajaDisabled ? ' (bloqueado por perfil)' : ''}` : 'Ir a Caja', enabled: !cajaDisabled, click: () => openViewFromTray('caja') },
        { label: 'Ir a Imagen', click: () => openViewFromTray('imagen') },
        { label: 'Ir a Configuración', click: () => openViewFromTray('config') },
        { type: 'separator' },
        { label: 'Publicidad', type: 'checkbox', enabled: publicidadAllowed, checked: publicidadChecked, click: (item) => {
                setPublicidadActive(item.checked === true);
            } },
        { label: 'Resetear posición/tamaño (ventana actual)', click: async () => {
                try {
                    if (!mainWindow)
                        return;
                    if (currentViewName === 'imagen') {
                        store.delete('imagenWindowBounds');
                        mainWindow.setSize(420, 420);
                        try {
                            mainWindow.center();
                        }
                        catch { }
                    }
                    else if (currentViewName === 'caja') {
                        store.delete('cajaWindowBounds');
                        mainWindow.setSize(420, 320);
                        try {
                            mainWindow.center();
                        }
                        catch { }
                    }
                    else {
                        // Administración/login
                        mainWindow.setSize(500, 400);
                        try {
                            mainWindow.center();
                        }
                        catch { }
                    }
                }
                catch { }
            } },
        { type: 'separator' },
        { label: 'Salir', click: () => { isQuitting = true; electron_1.app.quit(); } }
    ];
    return electron_1.Menu.buildFromTemplate(template);
}
function refreshTrayMenu() {
    try {
        if (tray)
            tray.setContextMenu(buildTrayMenu());
    }
    catch { }
}
function createTray() {
    if (tray)
        return;
    tray = new electron_1.Tray(getTrayImage());
    try {
        tray.setToolTip('MP');
    }
    catch { }
    tray.on('click', () => {
        if (!mainWindow)
            return;
        if (mainWindow.isVisible())
            hideToTray();
        else
            showMainWindow();
    });
    refreshTrayMenu();
}
function saveCajaWindowPosition() {
    try {
        if (!mainWindow)
            return;
        const bounds = mainWindow.getBounds();
        const display = electron_1.screen.getDisplayMatching(bounds);
        const work = display.workArea || display.bounds;
        store.set('cajaWindowBounds', {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            workW: work.width,
            workH: work.height,
            workX: work.x,
            workY: work.y,
            displayId: display.id
        });
    }
    catch { }
}
function restoreCajaWindowPosition(minWidth = 420, minHeight = 320) {
    try {
        const saved = store.get('cajaWindowBounds');
        if (!saved || saved.x === undefined || saved.y === undefined)
            return false;
        const displays = electron_1.screen.getAllDisplays();
        let target = saved.displayId !== undefined ? displays.find(d => d.id === saved.displayId) : undefined;
        if (!target) {
            target = electron_1.screen.getDisplayMatching({ x: saved.x, y: saved.y, width: saved.width || minWidth, height: saved.height || minHeight }) || electron_1.screen.getPrimaryDisplay();
        }
        const work = target.workArea || target.bounds;
        const baseW = saved.workW && saved.workW > 0 ? saved.workW : work.width;
        const baseH = saved.workH && saved.workH > 0 ? saved.workH : work.height;
        const baseX = saved.workX !== undefined ? saved.workX : work.x;
        const baseY = saved.workY !== undefined ? saved.workY : work.y;
        const scaleX = baseW > 0 ? work.width / baseW : 1;
        const scaleY = baseH > 0 ? work.height / baseH : 1;
        const offsetX = saved.x - baseX;
        const offsetY = saved.y - baseY;
        let x = work.x + Math.round(offsetX * scaleX);
        let y = work.y + Math.round(offsetY * scaleY);
        let w = Math.max(minWidth, Math.round((saved.width || minWidth) * scaleX));
        let h = Math.max(minHeight, Math.round((saved.height || minHeight) * scaleY));
        x = Math.max(work.x, Math.min(x, work.x + work.width - minWidth));
        y = Math.max(work.y, Math.min(y, work.y + work.height - minHeight));
        if (mainWindow)
            mainWindow.setBounds({ x, y, width: w, height: h });
        return true;
    }
    catch {
        return false;
    }
}
// Guardar tamaño/posición para vista imagen en ventana principal
function saveImagenWindowBounds() {
    try {
        if (!mainWindow)
            return;
        const bounds = mainWindow.getBounds();
        const display = electron_1.screen.getDisplayMatching(bounds);
        const work = display.workArea || display.bounds;
        store.set('imagenWindowBounds', {
            x: bounds.x,
            y: bounds.y,
            width: bounds.width,
            height: bounds.height,
            workW: work.width,
            workH: work.height,
            workX: work.x,
            workY: work.y,
            displayId: display.id
        });
    }
    catch { }
}
function restoreImagenWindowBounds(minWidth = 420, minHeight = 420) {
    try {
        const saved = store.get('imagenWindowBounds');
        if (!saved || saved.x === undefined || saved.y === undefined || !saved.width || !saved.height)
            return false;
        const displays = electron_1.screen.getAllDisplays();
        let target = saved.displayId !== undefined ? displays.find(d => d.id === saved.displayId) : undefined;
        if (!target) {
            target = electron_1.screen.getDisplayMatching({ x: saved.x, y: saved.y, width: saved.width, height: saved.height }) || electron_1.screen.getPrimaryDisplay();
        }
        const work = target.workArea || target.bounds;
        const baseW = saved.workW && saved.workW > 0 ? saved.workW : work.width;
        const baseH = saved.workH && saved.workH > 0 ? saved.workH : work.height;
        const baseX = saved.workX !== undefined ? saved.workX : work.x;
        const baseY = saved.workY !== undefined ? saved.workY : work.y;
        const scaleX = baseW > 0 ? work.width / baseW : 1;
        const scaleY = baseH > 0 ? work.height / baseH : 1;
        const offsetX = saved.x - baseX;
        const offsetY = saved.y - baseY;
        let x = work.x + Math.round(offsetX * scaleX);
        let y = work.y + Math.round(offsetY * scaleY);
        let w = Math.max(minWidth, Math.round(saved.width * scaleX));
        let h = Math.max(minHeight, Math.round(saved.height * scaleY));
        x = Math.max(work.x, Math.min(x, work.x + work.width - minWidth));
        y = Math.max(work.y, Math.min(y, work.y + work.height - minHeight));
        if (mainWindow) {
            mainWindow.setBounds({ x, y, width: w, height: h });
        }
        return true;
    }
    catch {
        return false;
    }
}
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
function isWebUrl(value) {
    try {
        if (!value || typeof value !== 'string')
            return false;
        const lower = value.trim().toLowerCase();
        if (lower.startsWith('http://') || lower.startsWith('https://'))
            return true;
        // URL constructor puede lanzar en Windows con rutas locales; usar chequeo simple
        return false;
    }
    catch {
        return false;
    }
}
// (revertido) normalización de rutas eliminada a pedido del cliente
let store;
try {
    store = new electron_store_1.default({ name: 'settings', encryptionKey: getEncryptionKey() });
}
catch (e) {
    try {
        const dir = electron_1.app.getPath('userData');
        const storePath = path_1.default.join(dir, 'settings.json');
        const backupPath = path_1.default.join(dir, `settings.bak-${Date.now()}.json`);
        if (fs_1.default.existsSync(storePath)) {
            fs_1.default.renameSync(storePath, backupPath);
            try {
                (0, LogService_1.logWarning)('Config corrupta detectada, creando backup y reestableciendo', { storePath, backupPath });
            }
            catch { }
        }
    }
    catch { }
    // Reintentar creación del store
    store = new electron_store_1.default({ name: 'settings', encryptionKey: getEncryptionKey() });
}
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
    // Elegir vista inicial: priorizar la última vista usada; si no existe, usar DEFAULT_VIEW y por defecto 'caja'
    const lastView = store.get('lastView');
    let defaultView = (() => {
        if (lastView === 'config' || lastView === 'caja' || lastView === 'imagen')
            return lastView;
        const v = String(cfg?.DEFAULT_VIEW || '').toLowerCase();
        if (v === 'config')
            return 'config';
        if (v === 'imagen')
            return 'imagen';
        return 'caja';
    })();
    // Si la vista por defecto es administración (config), forzar autenticación previa
    const initialFile = defaultView === 'caja' ? 'caja.html' : (defaultView === 'imagen' ? 'imagen.html' : 'auth.html');
    currentViewName = defaultView;
    // Inicializar DB de facturación al inicio
    try {
        (0, DbService_1.getDb)();
    }
    catch (e) {
        console.warn('DB init error', e);
    }
    // Bypass de licencia en desarrollo si SKIP_LICENSE=true o flag --skip-license
    const devBypass = (!electron_1.app.isPackaged) && (String(process.env.SKIP_LICENSE).toLowerCase() === 'true' || process.argv.includes('--skip-license'));
    // Ajustar visibilidad de menú y tamaño acorde a la vista inicial
    try {
        if (defaultView === 'caja') {
            // Tamaño compacto como la captura
            mainWindow.setMinimumSize(420, 320);
            mainWindow.setMenuBarVisibility(false);
            mainWindow.setAutoHideMenuBar(true);
            // Restaurar posición guardada para modo caja (escalando por resolución)
            if (!restoreCajaWindowPosition(420, 320)) {
                mainWindow.setSize(420, 320);
                // Si no hay posición guardada, centrar
                try {
                    mainWindow.center();
                }
                catch { }
            }
        }
        else if (defaultView === 'imagen') {
            mainWindow.setMinimumSize(420, 420);
            mainWindow.setMenuBarVisibility(false);
            mainWindow.setAutoHideMenuBar(true);
            if (!restoreImagenWindowBounds(420, 420)) {
                mainWindow.setSize(420, 420);
                try {
                    mainWindow.center();
                }
                catch { }
            }
        }
        else {
            // Administración: iniciar siempre en pantalla de autenticación
            mainWindow.setMinimumSize(500, 400);
            mainWindow.setSize(500, 400);
            mainWindow.setMenuBarVisibility(false);
            mainWindow.setAutoHideMenuBar(true);
            try {
                mainWindow.center();
            }
            catch { }
        }
    }
    catch { }
    // Gate de licencia: si no existe/vale y no estamos en bypass, mostrar licencia.html
    if (!devBypass) {
        try {
            const licOk = (0, licencia_1.licenciaExisteYValida)();
            if (!licOk) {
                const licPath = path_1.default.join(electron_1.app.getAppPath(), 'public', 'licencia.html');
                // Asegurar tamaño cómodo para el formulario de licencia
                try {
                    mainWindow.setMinimumSize(700, 760);
                    mainWindow.setSize(800, 820);
                    mainWindow.setMenuBarVisibility(false);
                    mainWindow.setAutoHideMenuBar(true);
                    try {
                        mainWindow.center();
                    }
                    catch { }
                }
                catch { }
                mainWindow.loadFile(licPath);
                return;
            }
        }
        catch {
            const licPath = path_1.default.join(electron_1.app.getAppPath(), 'public', 'licencia.html');
            try {
                mainWindow.setMinimumSize(700, 760);
                mainWindow.setSize(800, 820);
                mainWindow.setMenuBarVisibility(false);
                mainWindow.setAutoHideMenuBar(true);
                try {
                    mainWindow.center();
                }
                catch { }
            }
            catch { }
            mainWindow.loadFile(licPath);
            return;
        }
    }
    // Si bypass o licencia válida, cargar vista inicial
    const htmlPath = path_1.default.join(electron_1.app.getAppPath(), 'public', initialFile);
    mainWindow.loadFile(htmlPath);
    // Minimizar a bandeja (Windows)
    mainWindow.on('minimize', (e) => {
        try {
            e.preventDefault();
        }
        catch { }
        saveCajaWindowPosition();
        hideToTray();
    });
    mainWindow.on('close', (e) => {
        if (isQuitting)
            return;
        try {
            e.preventDefault();
        }
        catch { }
        saveCajaWindowPosition();
        hideToTray();
    });
    mainWindow.on('show', () => {
        try {
            mainWindow?.setSkipTaskbar(false);
        }
        catch { }
    });
    // Guardar posición de la ventana cuando se mueve (solo para modo caja)
    mainWindow.on('moved', () => {
        if (currentViewName === 'caja') {
            saveCajaWindowPosition();
        }
        else if (currentViewName === 'imagen') {
            saveImagenWindowBounds();
        }
    });
    mainWindow.on('resize', () => {
        if (currentViewName === 'caja') {
            saveCajaWindowPosition();
        }
        else if (currentViewName === 'imagen') {
            saveImagenWindowBounds();
        }
    });
    mainWindow.on('closed', () => {
        mainWindow = null;
    });
}
function notifySystem(title, body) {
    try {
        if (electron_1.Notification.isSupported()) {
            new electron_1.Notification({ title, body, silent: false }).show();
        }
    }
    catch { }
}
// Desactivar aceleración por GPU (mejora compatibilidad en WSL/VMs)
electron_1.app.disableHardwareAcceleration();
// Instancia única: evita múltiples procesos y enfoca la ventana existente
const gotTheLock = electron_1.app.requestSingleInstanceLock();
if (!gotTheLock) {
    electron_1.app.quit();
}
else {
    electron_1.app.on('second-instance', () => {
        try {
            if (mainWindow) {
                try {
                    if (mainWindow.isMinimized())
                        mainWindow.restore();
                }
                catch { }
                showMainWindow();
            }
            else {
                createMainWindow();
            }
        }
        catch { }
    });
}
electron_1.app.whenReady().then(() => {
    (0, LogService_1.ensureLogsDir)();
    (0, LogService_1.ensureTodayLogExists)();
    try {
        electron_1.Menu.setApplicationMenu(null);
    }
    catch { }
    // Autoarranque FTP Server si está habilitado
    try {
        const cfg = store.get('config') || {};
        if (cfg.FTP_SRV_ENABLED) {
            (0, FtpServerService_1.startFtpServer)({
                host: cfg.FTP_SRV_HOST || '0.0.0.0',
                port: Number(cfg.FTP_SRV_PORT || 2121),
                user: cfg.FTP_SRV_USER || 'user',
                pass: cfg.FTP_SRV_PASS || 'pass',
                root: cfg.FTP_SRV_ROOT || 'C:\\tmp\\ftp_share'
            }).then((ok) => { if (ok)
                (0, LogService_1.logInfo)('FTP auto-start OK');
            else
                (0, LogService_1.logWarning)('FTP auto-start failed'); }).catch(() => { });
        }
    }
    catch { }
    // ===== AUTO-UPDATE (electron-updater) =====
    try {
        const ghToken = process.env.GH_TOKEN || '';
        if (ghToken) {
            electron_updater_1.autoUpdater.requestHeaders = { Authorization: `token ${ghToken}` };
        }
        electron_updater_1.autoUpdater.autoDownload = false;
        electron_updater_1.autoUpdater.on('error', (error) => {
            try {
                (0, LogService_1.logError)('AutoUpdate error', { message: String(error?.message || error) });
            }
            catch { }
            try {
                mainWindow?.setProgressBar(-1);
            }
            catch { }
        });
        electron_updater_1.autoUpdater.on('update-available', async (info) => {
            try {
                const result = await electron_1.dialog.showMessageBox(mainWindow ?? undefined, {
                    type: 'info',
                    buttons: ['Actualizar ahora', 'Más tarde'],
                    defaultId: 0,
                    cancelId: 1,
                    title: 'Actualización disponible',
                    message: `Se encontró una nueva versión (${info?.version || ''}). ¿Desea instalarla ahora?`
                });
                if (result.response === 0) {
                    // Limpiar pendientes para evitar EPERM por residuos
                    cleanupUpdaterPendingDir();
                    try {
                        try {
                            mainWindow?.setProgressBar(0.01);
                        }
                        catch { }
                        await electron_updater_1.autoUpdater.downloadUpdate();
                    }
                    catch (e) {
                        try {
                            (0, LogService_1.logError)('AutoUpdate download failed', { message: String(e?.message || e) });
                        }
                        catch { }
                        try {
                            mainWindow?.setProgressBar(-1);
                        }
                        catch { }
                    }
                }
            }
            catch (e) {
                try {
                    (0, LogService_1.logError)('AutoUpdate prompt failed', { message: String(e?.message || e) });
                }
                catch { }
            }
        });
        electron_updater_1.autoUpdater.on('download-progress', (progress) => {
            try {
                const percent = Number(progress?.percent || 0);
                mainWindow?.setProgressBar(Math.max(0, Math.min(1, percent / 100)));
                (0, LogService_1.logInfo)('AutoUpdate progress', {
                    percent: Math.round(percent * 10) / 10,
                    transferred: Number(progress?.transferred || 0),
                    total: Number(progress?.total || 0)
                });
            }
            catch { }
        });
        electron_updater_1.autoUpdater.on('update-downloaded', async () => {
            try {
                const result = await electron_1.dialog.showMessageBox(mainWindow ?? undefined, {
                    type: 'info',
                    buttons: ['Reiniciar y actualizar', 'Después'],
                    defaultId: 0,
                    cancelId: 1,
                    title: 'Actualización lista',
                    message: 'La actualización está lista. ¿Desea reiniciar la aplicación para instalarla?'
                });
                if (result.response === 0) {
                    setImmediate(() => electron_updater_1.autoUpdater.quitAndInstall());
                }
                try {
                    mainWindow?.setProgressBar(-1);
                }
                catch { }
            }
            catch (e) {
                try {
                    (0, LogService_1.logError)('AutoUpdate restart prompt failed', { message: String(e?.message || e) });
                }
                catch { }
            }
        });
        // Buscar actualizaciones al inicio
        electron_updater_1.autoUpdater.checkForUpdates().catch((e) => {
            try {
                (0, LogService_1.logWarning)('AutoUpdate check failed', { message: String(e?.message || e) });
            }
            catch { }
        });
    }
    catch (e) {
        try {
            (0, LogService_1.logWarning)('AutoUpdate setup failed', { message: String(e?.message || e) });
        }
        catch { }
    }
    // IPC seguro para configuración
    electron_1.ipcMain.handle('get-config', () => {
        return store.get('config') || {};
    });
    electron_1.ipcMain.handle('save-config', (_event, cfg) => {
        if (cfg && typeof cfg === 'object') {
            store.set('config', cfg);
            // Refrescar menú de bandeja para reflejar cambios como IMAGE_PUBLICIDAD_ALLOWED
            try {
                refreshTrayMenu();
            }
            catch { }
            // Reiniciar timers para aplicar cambios
            restartRemoteTimerIfNeeded();
            restartImageTimerIfNeeded();
            restartWatchersIfNeeded();
            return true;
        }
        return false;
    });
    electron_1.ipcMain.handle('test-connection', async () => {
        return await (0, MercadoPagoService_1.testConnection)();
    });
    // Validar existencia de carpeta remota (modo "remoto")
    electron_1.ipcMain.handle('auto-remote:validate-dir', async (_e, dirPath) => {
        try {
            if (!dirPath || typeof dirPath !== 'string')
                return { ok: false, exists: false, isDir: false };
            const exists = fs_1.default.existsSync(dirPath);
            let isDir = false;
            if (exists) {
                try {
                    isDir = fs_1.default.statSync(dirPath).isDirectory();
                }
                catch { }
            }
            return { ok: true, exists, isDir };
        }
        catch (e) {
            return { ok: false, exists: false, isDir: false, error: String(e?.message || e) };
        }
    });
    // Generar reporte bajo demanda
    electron_1.ipcMain.handle('generate-report', async () => {
        (0, LogService_1.logInfo)('Reporte manual solicitado');
        try {
            const res = await runReportFlowAndNotify('manual');
            return res;
        }
        catch (error) {
            // Capturar error específico de MP_ACCESS_TOKEN y mostrar mensaje amigable
            if (error.message && error.message.includes('MP_ACCESS_TOKEN')) {
                const userMessage = '❌ Error: Comprobar la cuenta de Mercado Pago. Ve a Configuración → Mercado Pago y verifica el Access Token.';
                if (mainWindow) {
                    mainWindow.webContents.send('auto-report-notice', { error: userMessage });
                }
                (0, LogService_1.logError)('Error de configuración Mercado Pago', { message: userMessage });
                (0, ErrorNotificationService_1.recordError)('MP_CONFIG', 'Error de configuración Mercado Pago', { message: userMessage });
                notifySystem('MP – Configuración requerida', 'Verifica el Access Token en Configuración → Mercado Pago');
                throw new Error(userMessage);
            }
            else {
                const msg = String(error?.message || error);
                if (mainWindow)
                    mainWindow.webContents.send('auto-report-notice', { error: msg });
                // Notificar caída de comunicación con MP
                (0, ErrorNotificationService_1.recordError)('MP_COMM', 'Fallo de comunicación con Mercado Pago', { message: msg });
                notifySystem('MP – Comunicación fallida', 'No se pudo consultar Mercado Pago. Revisa conexión y credenciales.');
                throw error;
            }
        }
    });
    // Export on-demand without re-fetch (assumes files already generated or uses latest payments)
    electron_1.ipcMain.handle('export-report', async () => {
        const outDir = (0, ReportService_1.getOutDir)();
        return { outDir };
    });
    // Versión de la app para mostrar en UI
    electron_1.ipcMain.handle('get-app-version', async () => {
        try {
            return { version: electron_1.app.getVersion() };
        }
        catch {
            return { version: 'unknown' };
        }
    });
    // ===== ABOUT: Release notes =====
    electron_1.ipcMain.handle('about:get-release-notes', async () => {
        try {
            const p = path_1.default.join(electron_1.app.getAppPath(), 'docs', 'RELEASE_NOTES.md');
            const exists = fs_1.default.existsSync(p);
            const content = exists ? fs_1.default.readFileSync(p, 'utf8') : 'No hay notas de versión disponibles.';
            return { ok: true, path: p, content };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
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
    // FTP: enviar archivo arbitrario seleccionado en disco
    electron_1.ipcMain.handle('ftp:send-file', async (_e, { localPath, remoteName }) => {
        try {
            if (!localPath)
                return { ok: false, error: 'Ruta local vacía' };
            const res = await (0, FtpService_1.sendArbitraryFile)(localPath, remoteName);
            return { ok: true, ...res };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    // FTP: limpiar hash para forzar próximo envío
    electron_1.ipcMain.handle('clear-ftp-hash', async () => {
        try {
            const { clearLastSentHash } = await Promise.resolve().then(() => __importStar(require('./services/FtpService')));
            clearLastSentHash();
            return { ok: true };
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
    // Abrir ruta arbitraria (archivo/carpeta)
    electron_1.ipcMain.handle('open-path', async (_e, fullPath) => {
        try {
            if (!fullPath)
                return { ok: false, error: 'Ruta vacía' };
            let target = fullPath;
            // Normalizar rutas Windows: agregar ':' si falta (C\\tmp → C:\\tmp) y ajustar separadores
            if (process.platform === 'win32') {
                const m = target.match(/^([a-zA-Z])(\\|\/)/);
                if (m && !/^([a-zA-Z]):/.test(target)) {
                    target = `${m[1]}:${target.slice(1)}`;
                }
                target = target.replace(/\//g, '\\');
            }
            // Crear carpeta si no existe (uso común de este botón)
            try {
                if (!fs_1.default.existsSync(target)) {
                    fs_1.default.mkdirSync(target, { recursive: true });
                }
            }
            catch { }
            await electron_1.shell.openPath(target);
            return { ok: true, path: target };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
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
    // Abrir vistas (config/caja/imagen)
    electron_1.ipcMain.handle('open-view', async (_evt, view) => {
        console.log('[main] open-view →', view);
        if (view === 'config') {
            // Para config, siempre abrir auth.html primero
            const authFile = 'auth.html';
            console.log('[main] config requested → loading auth.html');
            if (mainWindow) {
                const target = path_1.default.join(electron_1.app.getAppPath(), 'public', authFile);
                console.log('[main] loading auth file:', target);
                // Ajustar tamaño para auth
                try {
                    mainWindow.setMinimumSize(500, 400);
                    mainWindow.setSize(500, 400);
                    mainWindow.setMenuBarVisibility(false);
                    mainWindow.setAutoHideMenuBar(true);
                    try {
                        mainWindow.center();
                    }
                    catch { }
                }
                catch { }
                await mainWindow.loadFile(target);
                console.log('[main] auth.html loaded');
                return { ok: true };
            }
        }
        else if (view === 'caja') {
            // Para caja, abrir directamente
            const file = 'caja.html';
            console.log('[main] caja requested → loading caja.html');
            if (mainWindow) {
                currentViewName = 'caja';
                store.set('lastView', 'caja');
                const target = path_1.default.join(electron_1.app.getAppPath(), 'public', file);
                console.log('[main] loading file:', target);
                // Ajustar tamaño según vista
                try {
                    mainWindow.setMinimumSize(420, 320);
                    mainWindow.setSize(420, 320);
                    mainWindow.setMenuBarVisibility(false);
                    mainWindow.setAutoHideMenuBar(true);
                    // Restaurar posición guardada para modo caja
                    const savedPosition = store.get('cajaWindowBounds');
                    if (savedPosition && savedPosition.x !== undefined && savedPosition.y !== undefined) {
                        // Verificar que la posición esté dentro de los límites de la pantalla
                        const { screen } = require('electron');
                        const primaryDisplay = screen.getPrimaryDisplay();
                        const { width, height } = primaryDisplay.workAreaSize;
                        // Asegurar que la ventana esté visible en la pantalla
                        const x = Math.max(0, Math.min(savedPosition.x, width - 420));
                        const y = Math.max(0, Math.min(savedPosition.y, height - 320));
                        const w = Math.max(420, savedPosition.width || 420);
                        const h = Math.max(320, savedPosition.height || 320);
                        mainWindow.setBounds({ x, y, width: w, height: h });
                    }
                    else {
                        // Si no hay posición guardada, centrar
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
        }
        else if (view === 'imagen') {
            // Para imagen, abrir directamente
            const file = 'imagen.html';
            console.log('[main] imagen requested → loading imagen.html');
            if (mainWindow) {
                currentViewName = 'imagen';
                store.set('lastView', 'imagen');
                const target = path_1.default.join(electron_1.app.getAppPath(), 'public', file);
                console.log('[main] loading file:', target);
                // Ajustar tamaño/posición para modo imagen (restaurar bounds si existen)
                try {
                    mainWindow.setMinimumSize(420, 420);
                    mainWindow.setMenuBarVisibility(false);
                    mainWindow.setAutoHideMenuBar(true);
                    // Intentar restaurar tamaño/posición previa del modo imagen
                    if (!restoreImagenWindowBounds(420, 420)) {
                        mainWindow.setSize(420, 420);
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
        }
        else if (view === 'galicia') {
            // Para galicia, abrir directamente
            const file = 'galicia.html';
            console.log('[main] galicia requested → loading galicia.html');
            if (mainWindow) {
                currentViewName = 'galicia';
                store.set('lastView', 'galicia');
                const target = path_1.default.join(electron_1.app.getAppPath(), 'public', file);
                console.log('[main] loading file:', target);
                // Ajustar tamaño para módulo galicia
                try {
                    mainWindow.setMinimumSize(1000, 700);
                    mainWindow.setSize(1200, 800);
                    mainWindow.setMenuBarVisibility(false);
                    mainWindow.setAutoHideMenuBar(true);
                    try {
                        mainWindow.center();
                    }
                    catch { }
                }
                catch { }
                await mainWindow.loadFile(target);
                console.log('[main] loadFile done');
                return { ok: true };
            }
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
    // IPC Facturación
    electron_1.ipcMain.handle('facturacion:guardar-config', async (_e, cfg) => {
        try {
            (0, DbService_1.getDb)().saveAfipConfig(cfg);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:emitir', async (_e, payload) => {
        try {
            const res = await (0, FacturacionService_1.getFacturacionService)().emitirFacturaYGenerarPdf(payload);
            return { ok: true, ...res };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:listar', async (_e, filtros) => {
        try {
            const rows = (0, DbService_1.getDb)().listFacturas(filtros?.desde, filtros?.hasta);
            return { ok: true, rows };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:abrir-pdf', async (_e, filePath) => {
        try {
            await (0, FacturacionService_1.getFacturacionService)().abrirPdf(filePath);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:empresa:get', async () => {
        try {
            return { ok: true, data: (0, DbService_1.getDb)().getEmpresaConfig() };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:empresa:save', async (_e, data) => {
        try {
            (0, DbService_1.getDb)().saveEmpresaConfig(data);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:param:get', async () => {
        try {
            return { ok: true, data: (0, DbService_1.getDb)().getParametrosFacturacion() };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:param:save', async (_e, data) => {
        try {
            (0, DbService_1.getDb)().saveParametrosFacturacion(data);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:pdfs', async () => {
        try {
            return { ok: true, rows: (0, DbService_1.getDb)().listPdfsEnDocumentos() };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    // ===== Validación de CAE =====
    electron_1.ipcMain.handle('facturacion:validate-cae', async (_e, { facturaId, operation }) => {
        try {
            afipService_1.afipService.validateCAEBeforeOperation(facturaId, operation);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:validate-cae-comprobante', async (_e, { numero, ptoVta, tipoCbte, operation }) => {
        try {
            afipService_1.afipService.validateCAEBeforeOperationByComprobante(numero, ptoVta, tipoCbte, operation);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:get-cae-status', async (_e, { facturaId }) => {
        try {
            const status = afipService_1.afipService.getCAEStatus(facturaId);
            return { ok: true, status };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:get-cae-status-comprobante', async (_e, { numero, ptoVta, tipoCbte }) => {
        try {
            const status = afipService_1.afipService.getCAEStatusByComprobante(numero, ptoVta, tipoCbte);
            return { ok: true, status };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:find-expiring-cae', async (_e, { warningThresholdHours } = {}) => {
        try {
            const facturas = afipService_1.afipService.findFacturasWithExpiringCAE(warningThresholdHours);
            return { ok: true, facturas };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('facturacion:find-expired-cae', async () => {
        try {
            const facturas = afipService_1.afipService.findFacturasWithExpiredCAE();
            return { ok: true, facturas };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    // ===== Gestión Provincial =====
    electron_1.ipcMain.handle('facturacion:emitir-con-provincias', async (_e, payload) => {
        try {
            const resultado = await (0, FacturacionService_1.getFacturacionService)().emitirFacturaConProvincias(payload);
            return { ok: true, resultado };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('provincia:get-configuracion', async () => {
        try {
            const provinciaManager = (0, ProvinciaManager_1.getProvinciaManager)();
            const configuracion = provinciaManager.getConfiguracion();
            return { ok: true, configuracion };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('provincia:actualizar-configuracion', async (_e, { jurisdiccion, config }) => {
        try {
            const provinciaManager = (0, ProvinciaManager_1.getProvinciaManager)();
            provinciaManager.actualizarConfiguracion(jurisdiccion, config);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('provincia:get-estadisticas', async () => {
        try {
            const provinciaManager = (0, ProvinciaManager_1.getProvinciaManager)();
            const estadisticas = await provinciaManager.getEstadisticas();
            return { ok: true, estadisticas };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('provincia:recargar-configuracion', async () => {
        try {
            const provinciaManager = (0, ProvinciaManager_1.getProvinciaManager)();
            provinciaManager.recargarConfiguracion();
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    // ===== Handlers AFIP =====
    electron_1.ipcMain.handle('afip:check-server-status', async () => {
        try {
            const status = await afipService_1.afipService.checkServerStatus();
            return { ok: true, ...status };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('afip:validar-certificado', async () => {
        try {
            const certInfo = afipService_1.afipService.validarCertificado();
            return { ok: true, ...certInfo };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    createMainWindow();
    createTray();
    electron_1.app.on('before-quit', () => { isQuitting = true; });
    // Programación automática
    let autoTimer = null;
    let autoActive = false;
    let autoPaused = false;
    let remainingSeconds = 0;
    let countdownTimer = null;
    // Timer autónomo para "remoto"
    let remoteTimer = null;
    // Timer dedicado para "modo imagen"
    let imageTimer = null;
    // Watchers en tiempo real (sin intervalo)
    let remoteWatcher = null;
    let imageWatcher = null;
    function isDayEnabled() {
        const cfg = store.get('config') || {};
        const now = new Date();
        const day = now.getDay(); // 0=Dom, 1=Lun, ... 6=Sáb
        const enabledByDay = [
            cfg.AUTO_DAYS_SUNDAY,
            cfg.AUTO_DAYS_MONDAY,
            cfg.AUTO_DAYS_TUESDAY,
            cfg.AUTO_DAYS_WEDNESDAY,
            cfg.AUTO_DAYS_THURSDAY,
            cfg.AUTO_DAYS_FRIDAY,
            cfg.AUTO_DAYS_SATURDAY
        ];
        if (enabledByDay[day] === false)
            return false;
        // Validar rango horario opcional por día: HH:mm → minutos desde 00:00
        function toMinutes(hhmm) {
            if (!hhmm || typeof hhmm !== 'string')
                return null;
            const m = hhmm.match(/^([0-1]?\d|2[0-3]):([0-5]\d)$/);
            if (!m)
                return null;
            return parseInt(m[1], 10) * 60 + parseInt(m[2], 10);
        }
        const mapFrom = [
            cfg.AUTO_FROM_SUNDAY,
            cfg.AUTO_FROM_MONDAY,
            cfg.AUTO_FROM_TUESDAY,
            cfg.AUTO_FROM_WEDNESDAY,
            cfg.AUTO_FROM_THURSDAY,
            cfg.AUTO_FROM_FRIDAY,
            cfg.AUTO_FROM_SATURDAY
        ];
        const mapTo = [
            cfg.AUTO_TO_SUNDAY,
            cfg.AUTO_TO_MONDAY,
            cfg.AUTO_TO_TUESDAY,
            cfg.AUTO_TO_WEDNESDAY,
            cfg.AUTO_TO_THURSDAY,
            cfg.AUTO_TO_FRIDAY,
            cfg.AUTO_TO_SATURDAY
        ];
        const fromMin = toMinutes(mapFrom[day]);
        const toMin = toMinutes(mapTo[day]);
        if (fromMin === null && toMin === null)
            return true; // sin restricción horaria
        const nowMin = now.getHours() * 60 + now.getMinutes();
        if (fromMin !== null && toMin !== null) {
            if (toMin >= fromMin) {
                return nowMin >= fromMin && nowMin <= toMin;
            }
            else {
                // Rango nocturno (cruza medianoche): activo si (>= from) o (<= to)
                return nowMin >= fromMin || nowMin <= toMin;
            }
        }
        if (fromMin !== null && toMin === null)
            return nowMin >= fromMin;
        if (fromMin === null && toMin !== null)
            return nowMin <= toMin;
        return true;
    }
    function stopAutoTimer() {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
        autoActive = false;
    }
    function stopRemoteTimer() {
        if (remoteTimer) {
            clearInterval(remoteTimer);
            remoteTimer = null;
        }
    }
    function stopImageTimer() {
        if (imageTimer) {
            clearInterval(imageTimer);
            imageTimer = null;
        }
    }
    function stopRemoteWatcher() {
        try {
            remoteWatcher?.close();
        }
        catch { }
        remoteWatcher = null;
    }
    function stopImageWatcher() {
        try {
            imageWatcher?.close();
        }
        catch { }
        imageWatcher = null;
    }
    // Evitar reentradas/concurrencia entre remoto e imagen
    let unifiedScanBusy = false;
    function startCountdown(seconds) {
        remainingSeconds = seconds;
        if (countdownTimer)
            clearInterval(countdownTimer);
        countdownTimer = setInterval(() => {
            remainingSeconds--;
            if (remainingSeconds <= 0) {
                // Reiniciar el countdown con los segundos configurados
                remainingSeconds = seconds;
            }
            // Notificar a la UI el tiempo restante
            if (mainWindow) {
                mainWindow.webContents.send('auto-timer-update', {
                    remaining: remainingSeconds,
                    configured: seconds
                });
            }
        }, 1000);
    }
    function delay(ms) {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }
    // Timer unificado para "remoto" (prioridad) e "imagen"
    function startRemoteTimer() {
        stopRemoteTimer();
        const cfg = store.get('config') || {};
        const globalIntervalSec = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
        const remoteIntervalMs = Number(cfg.AUTO_REMOTE_MS_INTERVAL || 0);
        const useRemoteWatch = cfg.AUTO_REMOTE_WATCH === true;
        const useImageWatch = cfg.IMAGE_WATCH === true;
        const intervalMs = Number.isFinite(remoteIntervalMs) && remoteIntervalMs > 0
            ? remoteIntervalMs
            : Math.max(1, globalIntervalSec) * 1000;
        const enabled = cfg.AUTO_REMOTE_ENABLED !== false;
        if (!enabled)
            return false;
        if (useRemoteWatch && useImageWatch)
            return false;
        if (!Number.isFinite(intervalMs) || intervalMs <= 0)
            return false;
        remoteTimer = setInterval(async () => {
            if (!isDayEnabled())
                return;
            if (unifiedScanBusy)
                return;
            unifiedScanBusy = true;
            try {
                // Prioridad 1: remoto solo si no está en modo watch
                const processedRemote = useRemoteWatch ? 0 : await processRemoteOnce();
                // Prioridad 2: imagen solo si no está en modo watch
                if (!useImageWatch && processedRemote === 0) {
                    await processImageControlOnce();
                }
                await cleanupImageArtifacts();
            }
            finally {
                unifiedScanBusy = false;
            }
        }, Math.max(10, intervalMs));
        return true;
    }
    function restartRemoteTimerIfNeeded() {
        stopRemoteTimer();
        startRemoteTimer();
    }
    // Timer de imagen unificado en el remoto (no crear otro)
    function startImageTimer() {
        return false;
    }
    function restartImageTimerIfNeeded() {
        /* unificado: sin acción */
    }
    // Watchers en tiempo real (sin intervalo)
    function startRemoteWatcher() {
        stopRemoteWatcher();
        const cfg = store.get('config') || {};
        if (cfg.AUTO_REMOTE_WATCH !== true)
            return false;
        const dir = String(cfg.AUTO_REMOTE_DIR || 'C\\tmp');
        try {
            if (!fs_1.default.existsSync(dir) || !fs_1.default.statSync(dir).isDirectory())
                return false;
            remoteWatcher = fs_1.default.watch(dir, { persistent: true }, (_event, filename) => {
                try {
                    const name = String(filename || '');
                    if (!name)
                        return;
                    if (!/^mp.*\.txt$/i.test(name))
                        return;
                    if (unifiedScanBusy)
                        return;
                    unifiedScanBusy = true;
                    setTimeout(async () => {
                        try {
                            await processRemoteOnce();
                            await cleanupImageArtifacts();
                        }
                        finally {
                            unifiedScanBusy = false;
                        }
                    }, 150);
                }
                catch { }
            });
            (0, LogService_1.logInfo)('Remote watcher started', { dir });
            return true;
        }
        catch {
            return false;
        }
    }
    function startImageWatcher() {
        stopImageWatcher();
        const cfg = store.get('config') || {};
        if (cfg.IMAGE_WATCH !== true)
            return false;
        const dir = String(cfg.IMAGE_CONTROL_DIR || 'C\\tmp');
        const controlFile = String(cfg.IMAGE_CONTROL_FILE || 'direccion.txt');
        try {
            if (!fs_1.default.existsSync(dir) || !fs_1.default.statSync(dir).isDirectory())
                return false;
            imageWatcher = fs_1.default.watch(dir, { persistent: true }, (_event, filename) => {
                try {
                    const name = String(filename || '');
                    if (!name)
                        return;
                    if (name.toLowerCase() !== controlFile.toLowerCase())
                        return;
                    if (unifiedScanBusy)
                        return;
                    unifiedScanBusy = true;
                    setTimeout(async () => {
                        try {
                            await processImageControlOnce();
                            await cleanupImageArtifacts();
                        }
                        finally {
                            unifiedScanBusy = false;
                        }
                    }, 150);
                }
                catch { }
            });
            (0, LogService_1.logInfo)('Image watcher started', { dir, controlFile });
            return true;
        }
        catch {
            return false;
        }
    }
    function restartWatchersIfNeeded() {
        stopRemoteWatcher();
        stopImageWatcher();
        startRemoteWatcher();
        startImageWatcher();
    }
    // Función reutilizable: ejecutar flujo de reporte y notificar a la UI
    async function runReportFlowAndNotify(origin = 'manual') {
        const { payments, range } = await (0, MercadoPagoService_1.searchPaymentsWithConfig)();
        const tag = new Date().toISOString().slice(0, 10);
        let result;
        try {
            result = await (0, ReportService_1.generateFiles)(payments, tag, range);
        }
        catch (e) {
            const code = String(e?.code || '').toUpperCase();
            if (code === 'EPERM' || code === 'EACCES' || code === 'EBUSY' || code === 'EEXIST') {
                try {
                    await delay(750);
                }
                catch { }
                result = await (0, ReportService_1.generateFiles)(payments, tag, range);
            }
            else {
                throw e;
            }
        }
        (0, LogService_1.logSuccess)('Archivos generados exitosamente', { files: result?.files, count: payments?.length, origin });
        // Auto-enviar mp.dbf vía FTP si está configurado
        let ftpAttempted = false;
        let ftpSent = false;
        let ftpSkipped = false;
        let ftpErrorMessage;
        try {
            const mpPath = result?.files?.mpDbfPath;
            if (mpPath && fs_1.default.existsSync(mpPath)) {
                ftpAttempted = true;
                const ftpResult = await (0, FtpService_1.sendDbf)(mpPath, 'mp.dbf', { force: true });
                if (ftpResult.skipped) {
                    ftpSkipped = true;
                    if (mainWindow)
                        mainWindow.webContents.send('auto-report-notice', { info: `FTP: sin cambios - no se envía` });
                }
                else {
                    ftpSent = true;
                    if (mainWindow)
                        mainWindow.webContents.send('auto-report-notice', { info: `FTP: enviado OK` });
                }
            }
        }
        catch (e) {
            ftpErrorMessage = String(e?.message || e);
            console.warn('[main] auto FTP send failed:', e);
            if (mainWindow)
                mainWindow.webContents.send('auto-report-notice', { error: `FTP: ${ftpErrorMessage}` });
        }
        // Reducir payload para UI
        const uiRows = payments.slice(0, 1000).map((p) => ({
            id: p?.id,
            status: p?.status,
            amount: p?.transaction_amount,
            date: p?.date_created,
            method: p?.payment_method_id
        }));
        if (mainWindow) {
            const rowsShort = uiRows.slice(0, 8);
            mainWindow.webContents.send('auto-report-notice', { [origin]: true, count: payments.length, rows: rowsShort });
        }
        return { count: payments.length, outDir: result.outDir, files: result.files, rows: uiRows, ftp: { attempted: ftpAttempted, sent: ftpSent, skipped: ftpSkipped, errorMessage: ftpErrorMessage } };
    }
    // Escaneo remoto una vez (autónomo)
    async function processRemoteOnce() {
        // Disparador remoto: siempre procesar sin respetar días/horas (requisito)
        try {
            const cfgNow = store.get('config') || {};
            const enabled = cfgNow.AUTO_REMOTE_ENABLED !== false;
            if (!enabled)
                return 0;
            const remoteDir = String(cfgNow.AUTO_REMOTE_DIR || 'C:\\tmp');
            let processed = 0;
            if (remoteDir && fs_1.default.existsSync(remoteDir)) {
                const entries = fs_1.default.readdirSync(remoteDir);
                const toProcess = entries.filter(name => /^mp.*\.txt$/i.test(name));
                // Procesar solo el primero por ciclo para evitar contención de archivos
                const first = toProcess[0];
                if (first) {
                    await runReportFlowAndNotify('remoto');
                    if (mainWindow)
                        mainWindow.webContents.send('auto-report-notice', { info: `Se procesó archivo remoto: ${first}` });
                    try {
                        fs_1.default.unlinkSync(path_1.default.join(remoteDir, first));
                    }
                    catch { }
                    processed += 1;
                }
            }
            return processed;
        }
        catch (e) {
            console.warn('[main] remoto: error procesando carpeta remota', e);
            return 0;
        }
    }
    // Procesamiento de archivos de control de imagen
    async function processImageControlOnce() {
        // Disparador de imagen: siempre procesar sin respetar días/horas (requisito)
        try {
            const cfgNow = store.get('config') || {};
            const enabled = cfgNow.IMAGE_ENABLED !== false; // propio enable para imagen
            if (!enabled)
                return 0;
            const controlDir = String(cfgNow.IMAGE_CONTROL_DIR || 'C:\\tmp');
            const controlFile = String(cfgNow.IMAGE_CONTROL_FILE || 'direccion.txt');
            const controlPath = path_1.default.join(controlDir, controlFile);
            if (!fs_1.default.existsSync(controlPath)) {
                return 0; // No hay archivo de control
            }
            let content = '';
            try {
                content = fs_1.default.readFileSync(controlPath, 'utf8');
            }
            catch (e) {
                const code = String(e?.code || '').toUpperCase();
                if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
                    // Otro proceso está escribiendo el archivo. Reintentar en el próximo intervalo.
                    (0, LogService_1.logInfo)('Imagen: archivo de control ocupado, reintentar', { controlPath, code });
                    return 0;
                }
                throw e;
            }
            content = String(content || '').trim();
            if (!content) {
                // Archivo vacío, eliminarlo
                try {
                    fs_1.default.unlinkSync(controlPath);
                }
                catch { }
                return 0;
            }
            // Parseo flexible: URI=... @VENTANA=... @INFO=...
            let filePath = '';
            let windowMode;
            let infoText;
            const parts = content.split('@');
            for (const raw of parts) {
                const seg = raw.trim();
                if (!seg)
                    continue;
                const [kRaw, ...rest] = seg.split('=');
                if (!rest.length) {
                    // si no hay '=' y aún no hay filePath, asumir que es una URI directa
                    if (!filePath)
                        filePath = seg;
                    continue;
                }
                const key = String(kRaw || '').trim().toUpperCase();
                const val = rest.join('=').trim();
                if (key === 'URI')
                    filePath = val;
                else if (key === 'VENTANA')
                    windowMode = String(val).trim().toLowerCase();
                else if (key === 'INFO')
                    infoText = val;
            }
            if (!filePath) {
                // fallback legacy: línea completa era la ruta
                filePath = content;
            }
            // Usar la ruta tal cual llega en el archivo de control (sin normalizar)
            // Si es una URL web y piden 'nueva', abrir en el navegador del sistema
            if (windowMode === 'nueva' && isWebUrl(filePath)) {
                try {
                    await electron_1.shell.openExternal(filePath);
                }
                catch { }
                try {
                    fs_1.default.unlinkSync(controlPath);
                }
                catch { }
                (0, LogService_1.logSuccess)('URL abierta en navegador del sistema', { url: filePath });
                return 1;
            }
            // Verificar si el archivo de contenido existe (solo para rutas locales/UNC).
            // Si no existe, intentar variante .mp4 cuando la solicitud era .jpg; si tampoco existe, usar fallback visual por defecto.
            let isFallback = false;
            if (!isWebUrl(filePath) && !fs_1.default.existsSync(filePath)) {
                (0, LogService_1.logError)('Archivo de contenido no encontrado', { filePath, originalContent: content });
                try {
                    // 1) Si el recurso pedido termina en .jpg, probar automáticamente la variante .mp4
                    const lower = String(filePath).toLowerCase();
                    if (lower.endsWith('.jpg')) {
                        const altVideoPath = filePath.slice(0, -4) + '.mp4';
                        if (fs_1.default.existsSync(altVideoPath)) {
                            (0, LogService_1.logInfo)('Alternativa encontrada: usando video .mp4 asociado a la imagen faltante', { altVideoPath });
                            filePath = altVideoPath; // usar el video y no marcar fallback visual
                        }
                        else {
                            // 2) No hay .mp4 asociado: aplicar fallback visual por defecto
                            const noImage = path_1.default.join(electron_1.app.getAppPath(), 'public', 'Noimage.jpg');
                            const logo = path_1.default.join(electron_1.app.getAppPath(), 'public', 'nombre_tc.png');
                            const candidate = fs_1.default.existsSync(noImage) ? noImage : (fs_1.default.existsSync(logo) ? logo : '');
                            if (candidate) {
                                filePath = candidate;
                                isFallback = true;
                                infoText = infoText ? `${infoText} • (no encontrado)` : 'Contenido no encontrado';
                            }
                            else {
                                try {
                                    fs_1.default.unlinkSync(controlPath);
                                }
                                catch { }
                                return 0;
                            }
                        }
                    }
                    else {
                        // 3) No era .jpg: aplicar directamente el fallback visual por defecto
                        const noImage = path_1.default.join(electron_1.app.getAppPath(), 'public', 'Noimage.jpg');
                        const logo = path_1.default.join(electron_1.app.getAppPath(), 'public', 'nombre_tc.png');
                        const candidate = fs_1.default.existsSync(noImage) ? noImage : (fs_1.default.existsSync(logo) ? logo : '');
                        if (candidate) {
                            filePath = candidate;
                            isFallback = true;
                            infoText = infoText ? `${infoText} • (no encontrado)` : 'Contenido no encontrado';
                        }
                        else {
                            try {
                                fs_1.default.unlinkSync(controlPath);
                            }
                            catch { }
                            return 0;
                        }
                    }
                }
                catch {
                    try {
                        fs_1.default.unlinkSync(controlPath);
                    }
                    catch { }
                    return 0;
                }
            }
            // Notificar a la UI sobre el nuevo contenido o abrir ventana separada
            // Si IMAGE_WINDOW_SEPARATE está tildado, forzar VENTANA=nueva para que el cajero pueda tener modo caja y modo imagen en ventanas separadas
            const forceSeparateWindow = cfgNow.IMAGE_WINDOW_SEPARATE === true;
            const wantNewWindow = (windowMode === 'nueva') || forceSeparateWindow;
            // En modo 'comun12' se envía a ambas: ventana actual (si corresponde) y ventana persistente (reutilizable)
            if (windowMode === 'comun12') {
                if (mainWindow) {
                    try {
                        mainWindow.setTitle(infoText || path_1.default.basename(filePath));
                    }
                    catch { }
                    // Llevar ventana principal al frente sin activarla (sin focus)
                    try {
                        mainWindow.moveTop(); // Primero mover al frente
                        mainWindow.focus(); // Luego dar focus
                        mainWindow.show(); // Finalmente hacer visible
                        // Métodos adicionales para Windows
                        try {
                            mainWindow.setAlwaysOnTop(true);
                        }
                        catch { }
                        setTimeout(() => {
                            try {
                                mainWindow?.setAlwaysOnTop(false);
                            }
                            catch { }
                        }, 100); // Quitar alwaysOnTop después de 100ms
                    }
                    catch { }
                    mainWindow.webContents.send('image:new-content', { filePath, info: infoText, windowMode: 'comun' });
                }
                // Reutilizar o crear la ventana persistente para presentación
                try {
                    if (!imageDualWindow || imageDualWindow.isDestroyed()) {
                        // Preparar configuración inicial optimizada para evitar flickering
                        const base = mainWindow?.getBounds();
                        let initialBounds = { x: 0, y: 0, width: 420, height: 420 };
                        // Intentar restaurar coordenadas guardadas primero
                        const saved = store.get('imageDualWindowBounds');
                        if (saved && saved.x !== undefined && saved.y !== undefined && saved.width && saved.height) {
                            // Validar que los bounds guardados sean válidos
                            try {
                                const displays = electron_1.screen.getAllDisplays();
                                let target = saved.displayId !== undefined ? displays.find(d => d.id === saved.displayId) : undefined;
                                if (!target) {
                                    target = electron_1.screen.getDisplayMatching({ x: saved.x, y: saved.y, width: saved.width, height: saved.height }) || electron_1.screen.getPrimaryDisplay();
                                }
                                const work = target.workArea || target.bounds;
                                const baseW = saved.workW && saved.workW > 0 ? saved.workW : work.width;
                                const baseH = saved.workH && saved.workH > 0 ? saved.workH : work.height;
                                const baseX = saved.workX !== undefined ? saved.workX : work.x;
                                const baseY = saved.workY !== undefined ? saved.workY : work.y;
                                const scaleX = baseW > 0 ? work.width / baseW : 1;
                                const scaleY = baseH > 0 ? work.height / baseH : 1;
                                const offsetX = saved.x - baseX;
                                const offsetY = saved.y - baseY;
                                let x = work.x + Math.round(offsetX * scaleX);
                                let y = work.y + Math.round(offsetY * scaleY);
                                let w = Math.max(420, Math.round(saved.width * scaleX));
                                let h = Math.max(420, Math.round(saved.height * scaleY));
                                x = Math.max(work.x, Math.min(x, work.x + work.width - 420));
                                y = Math.max(work.y, Math.min(y, work.y + work.height - 420));
                                initialBounds = { x, y, width: w, height: h };
                            }
                            catch { }
                        }
                        else if (base) {
                            // Si no hay bounds guardados, calcular posición centrada
                            try {
                                const display = electron_1.screen.getDisplayMatching(base);
                                const work = display.workArea || display.bounds;
                                const x = Math.max(work.x, Math.min(base.x + Math.floor((base.width - 420) / 2), work.x + work.width - 420));
                                const y = Math.max(work.y, Math.min(base.y + Math.floor((base.height - 420) / 2), work.y + work.height - 420));
                                initialBounds = { x, y, width: 420, height: 420 };
                            }
                            catch { }
                        }
                        imageDualWindow = new electron_1.BrowserWindow({
                            ...initialBounds,
                            title: infoText || path_1.default.basename(filePath),
                            backgroundColor: '#0f172a',
                            show: false, // No mostrar hasta estar listo
                            skipTaskbar: false, // Mostrar en la barra de tareas
                            alwaysOnTop: false, // No siempre al frente por defecto
                            focusable: true, // Permitir focus
                            webPreferences: { preload: path_1.default.join(electron_1.app.getAppPath(), 'dist', 'src', 'preload.js'), contextIsolation: true, nodeIntegration: false }
                        });
                        // Configurar ventana antes de mostrar
                        try {
                            imageDualWindow.setMenuBarVisibility(false);
                        }
                        catch { }
                        try {
                            imageDualWindow.setAutoHideMenuBar(true);
                        }
                        catch { }
                        // Configurar eventos de persistencia
                        imageDualWindow.on('closed', () => { imageDualWindow = null; });
                        imageDualWindow.on('moved', () => saveImageDualWindowBounds());
                        imageDualWindow.on('resize', () => saveImageDualWindowBounds());
                        imageDualWindow.on('maximize', () => saveImageDualWindowBounds());
                        imageDualWindow.on('unmaximize', () => saveImageDualWindowBounds());
                        // Cargar contenido y mostrar cuando esté listo
                        await imageDualWindow.loadFile(path_1.default.join(electron_1.app.getAppPath(), 'public', 'imagen.html'));
                        // Mostrar ventana una sola vez cuando esté completamente lista
                        imageDualWindow.show();
                    }
                    // Aplicar modo publicidad (pantalla completa) si está activo
                    try {
                        const active = isPublicidadActive();
                        try {
                            imageDualWindow.setFullScreenable(true);
                        }
                        catch { }
                        if (active) {
                            try {
                                imageDualWindow.setKiosk(true);
                            }
                            catch { }
                            try {
                                imageDualWindow.setAlwaysOnTop(true, 'screen-saver');
                            }
                            catch { }
                            try {
                                imageDualWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true });
                            }
                            catch { }
                            try {
                                imageDualWindow.setFullScreen(true);
                            }
                            catch { }
                        }
                        else {
                            try {
                                imageDualWindow.setKiosk(false);
                            }
                            catch { }
                            try {
                                imageDualWindow.setAlwaysOnTop(false);
                            }
                            catch { }
                            try {
                                imageDualWindow.setVisibleOnAllWorkspaces(false);
                            }
                            catch { }
                            try {
                                imageDualWindow.setFullScreen(false);
                            }
                            catch { }
                        }
                    }
                    catch { }
                    // La ventana ya se mostró arriba, solo aplicar "bring to front" suave
                    try {
                        imageDualWindow.showInactive(); // ← Muestra sin activar (no roba foco)
                        imageDualWindow.moveTop(); // ← Mueve al frente de la pila de ventanas
                        // Métodos adicionales para Windows
                        try {
                            imageDualWindow.setAlwaysOnTop(true);
                        }
                        catch { }
                        setTimeout(() => {
                            try {
                                imageDualWindow?.setAlwaysOnTop(false);
                            }
                            catch { }
                        }, 100); // Quitar alwaysOnTop después de 100ms
                    }
                    catch { }
                    try {
                        imageDualWindow?.setTitle(infoText || path_1.default.basename(filePath));
                    }
                    catch { }
                    imageDualWindow?.webContents.send('image:new-content', { filePath, info: infoText, windowMode: 'nueva12', fallback: isFallback, publicidad: isPublicidadActive() });
                }
                catch { }
            }
            else if (wantNewWindow) {
                // 'nueva': crear una nueva ventana. Primera vez: centrar; siguientes: restaurar coordenadas guardadas
                try {
                    // Política Producto Nuevo: reutilizar la última ventana si llegan muchas solicitudes seguidas
                    const pnEnabled = cfgNow.IMAGE_PRODUCTO_NUEVO_ENABLED === true;
                    const pnWaitSec = Number(cfgNow.IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS || 0);
                    const reuseWindow = pnEnabled && Number.isFinite(pnWaitSec) && pnWaitSec > 0 && (Date.now() - lastImageNewWindowAt) < pnWaitSec * 1000;
                    // Si forceSeparateWindow está activo, SIEMPRE reutilizar la ventana separada existente
                    const shouldReuseWindow = reuseWindow || forceSeparateWindow;
                    if (shouldReuseWindow && lastImageNewWindow && !lastImageNewWindow.isDestroyed()) {
                        // Llevar ventana al frente sin activarla (sin focus)
                        try {
                            lastImageNewWindow.showInactive(); // ← Muestra sin activar (no roba foco)
                            lastImageNewWindow.moveTop(); // ← Mueve al frente de la pila de ventanas
                            // Métodos adicionales para Windows
                            try {
                                lastImageNewWindow.setAlwaysOnTop(true);
                            }
                            catch { }
                            setTimeout(() => {
                                try {
                                    lastImageNewWindow?.setAlwaysOnTop(false);
                                }
                                catch { }
                            }, 100); // Quitar alwaysOnTop después de 100ms
                        }
                        catch { }
                        try {
                            lastImageNewWindow.setTitle(infoText || path_1.default.basename(filePath));
                        }
                        catch { }
                        lastImageNewWindow.webContents.send('image:new-content', { filePath, info: infoText, windowMode: 'nueva', fallback: isFallback });
                        lastImageNewWindowAt = Date.now();
                        if (forceSeparateWindow) {
                            (0, LogService_1.logInfo)('VENTANA=nueva reutilizada por IMAGE_WINDOW_SEPARATE', { forceSeparateWindow });
                        }
                        else {
                            (0, LogService_1.logInfo)('VENTANA=nueva reutilizada por Producto Nuevo', { withinSeconds: pnWaitSec });
                        }
                        // Ya refrescamos el contenido en la misma ventana
                        try {
                            fs_1.default.unlinkSync(controlPath);
                        }
                        catch { }
                        return 1;
                    }
                    // Preparar configuración inicial optimizada para evitar flickering
                    const base = mainWindow?.getBounds();
                    let initialBounds = { x: 0, y: 0, width: 420, height: 420 };
                    // Intentar restaurar coordenadas guardadas primero
                    const saved = store.get('imageNewWindowBounds');
                    if (saved && saved.x !== undefined && saved.y !== undefined && saved.width && saved.height) {
                        // Validar que los bounds guardados sean válidos
                        try {
                            const displays = electron_1.screen.getAllDisplays();
                            let target = saved.displayId !== undefined ? displays.find(d => d.id === saved.displayId) : undefined;
                            if (!target) {
                                target = electron_1.screen.getDisplayMatching({ x: saved.x, y: saved.y, width: saved.width, height: saved.height }) || electron_1.screen.getPrimaryDisplay();
                            }
                            const work = target.workArea || target.bounds;
                            const baseW = saved.workW && saved.workW > 0 ? saved.workW : work.width;
                            const baseH = saved.workH && saved.workH > 0 ? saved.workH : work.height;
                            const baseX = saved.workX !== undefined ? saved.workX : work.x;
                            const baseY = saved.workY !== undefined ? saved.workY : work.y;
                            const scaleX = baseW > 0 ? work.width / baseW : 1;
                            const scaleY = baseH > 0 ? work.height / baseH : 1;
                            const offsetX = saved.x - baseX;
                            const offsetY = saved.y - baseY;
                            let x = work.x + Math.round(offsetX * scaleX);
                            let y = work.y + Math.round(offsetY * scaleY);
                            let w = Math.max(420, Math.round(saved.width * scaleX));
                            let h = Math.max(420, Math.round(saved.height * scaleY));
                            x = Math.max(work.x, Math.min(x, work.x + work.width - 420));
                            y = Math.max(work.y, Math.min(y, work.y + work.height - 420));
                            initialBounds = { x, y, width: w, height: h };
                        }
                        catch { }
                    }
                    else if (base) {
                        // Si no hay bounds guardados, calcular posición centrada
                        try {
                            const display = electron_1.screen.getDisplayMatching(base);
                            const work = display.workArea || display.bounds;
                            const x = Math.max(work.x, Math.min(base.x + Math.floor((base.width - 420) / 2), work.x + work.width - 420));
                            const y = Math.max(work.y, Math.min(base.y + Math.floor((base.height - 420) / 2), work.y + work.height - 420));
                            initialBounds = { x, y, width: 420, height: 420 };
                        }
                        catch { }
                    }
                    const win = new electron_1.BrowserWindow({
                        ...initialBounds,
                        title: infoText || path_1.default.basename(filePath),
                        backgroundColor: '#0f172a',
                        show: false, // No mostrar hasta estar listo
                        skipTaskbar: false, // Mostrar en la barra de tareas
                        alwaysOnTop: false, // No siempre al frente por defecto
                        focusable: true, // Permitir focus
                        webPreferences: {
                            preload: path_1.default.join(electron_1.app.getAppPath(), 'dist', 'src', 'preload.js'),
                            contextIsolation: true,
                            nodeIntegration: false
                        }
                    });
                    // Configurar ventana antes de mostrar
                    try {
                        win.setMenuBarVisibility(false);
                    }
                    catch { }
                    try {
                        win.setAutoHideMenuBar(true);
                    }
                    catch { }
                    // Cerrar con ESC
                    try {
                        win.webContents.on('before-input-event', (event, input) => {
                            if (input.type === 'keyDown' && (input.key === 'Escape' || input.code === 'Escape')) {
                                try {
                                    event.preventDefault();
                                }
                                catch { }
                                try {
                                    win.close();
                                }
                                catch { }
                            }
                        });
                    }
                    catch { }
                    // Cargar contenido y mostrar cuando esté listo
                    await win.loadFile(path_1.default.join(electron_1.app.getAppPath(), 'public', 'imagen.html'));
                    // Mostrar ventana una sola vez cuando esté completamente lista
                    win.show();
                    win.on('moved', () => saveImageNewWindowBounds(win));
                    win.on('resize', () => saveImageNewWindowBounds(win));
                    win.on('closed', () => { if (lastImageNewWindow === win)
                        lastImageNewWindow = null; });
                    // La ventana ya se mostró arriba, solo aplicar "bring to front" suave
                    try {
                        win.showInactive(); // ← Muestra sin activar (no roba foco)
                        win.moveTop(); // ← Mueve al frente de la pila de ventanas
                        // Métodos adicionales para Windows
                        try {
                            win.setAlwaysOnTop(true);
                        }
                        catch { }
                        setTimeout(() => {
                            try {
                                win?.setAlwaysOnTop(false);
                            }
                            catch { }
                        }, 100); // Quitar alwaysOnTop después de 100ms
                    }
                    catch { }
                    try {
                        win.setTitle(infoText || path_1.default.basename(filePath));
                    }
                    catch { }
                    win.webContents.send('image:new-content', { filePath, info: infoText, windowMode: 'nueva', fallback: isFallback });
                    // Registrar como última ventana 'nueva'
                    lastImageNewWindow = win;
                    lastImageNewWindowAt = Date.now();
                }
                catch { }
            }
            else if (mainWindow) {
                try {
                    mainWindow.setTitle(infoText || path_1.default.basename(filePath));
                }
                catch { }
                // Llevar ventana al frente con secuencia completa
                try {
                    mainWindow.showInactive(); // ← Muestra sin activar (no roba foco)
                    mainWindow.moveTop(); // ← Mueve al frente de la pila de ventanas
                    // Métodos adicionales para Windows
                    try {
                        mainWindow.setAlwaysOnTop(true);
                    }
                    catch { }
                    setTimeout(() => {
                        try {
                            mainWindow?.setAlwaysOnTop(false);
                        }
                        catch { }
                    }, 100); // Quitar alwaysOnTop después de 100ms
                }
                catch { }
                // Si forceSeparateWindow está activo, siempre usar 'nueva' para que el cajero pueda tener modo caja y modo imagen en ventanas separadas
                const finalWindowMode = forceSeparateWindow ? 'nueva' : (windowMode || 'comun');
                mainWindow.webContents.send('image:new-content', { filePath, info: infoText, windowMode: finalWindowMode, fallback: isFallback });
            }
            // Eliminar archivo de control después de procesarlo
            try {
                fs_1.default.unlinkSync(controlPath);
            }
            catch { }
            (0, LogService_1.logSuccess)('Contenido de imagen procesado', { filePath, originalContent: content });
            return 1;
        }
        catch (e) {
            console.warn('[main] imagen: error procesando archivo de control', e);
            return 0;
        }
    }
    // Limpieza básica: eliminar .txt viejos en la carpeta de control
    async function cleanupImageArtifacts() {
        try {
            const cfg = store.get('config') || {};
            if (cfg.IMAGE_CLEANUP_ENABLED === false)
                return false;
            const controlDir = String(cfg.IMAGE_CONTROL_DIR || 'C:\\tmp');
            const maxHours = Number(cfg.IMAGE_CLEANUP_HOURS || 24);
            if (!fs_1.default.existsSync(controlDir))
                return false;
            const now = Date.now();
            const entries = fs_1.default.readdirSync(controlDir).filter((n) => n.toLowerCase().endsWith('.txt'));
            for (const name of entries) {
                try {
                    const p = path_1.default.join(controlDir, name);
                    const st = fs_1.default.statSync(p);
                    const ageHours = (now - st.mtimeMs) / (1000 * 60 * 60);
                    if (ageHours > maxHours) {
                        fs_1.default.unlinkSync(p);
                        (0, LogService_1.logInfo)('Imagen cleanup: .txt eliminado por antigüedad', { name, hours: Math.round(ageHours) });
                    }
                }
                catch { }
            }
            return true;
        }
        catch {
            return false;
        }
    }
    async function startAutoTimer() {
        stopAutoTimer();
        const cfg = store.get('config') || {};
        const intervalSec = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
        if (!Number.isFinite(intervalSec) || intervalSec <= 0)
            return false;
        // Si estaba pausado, usar el tiempo restante, sino usar el intervalo completo
        const startSeconds = autoPaused && remainingSeconds > 0 ? remainingSeconds : intervalSec;
        autoTimer = setInterval(async () => {
            // Verificar si el día actual está habilitado
            if (!isDayEnabled()) {
                if (mainWindow) {
                    mainWindow.webContents.send('auto-report-notice', {
                        info: 'Automático inactivo (día no habilitado)',
                        dayDisabled: true
                    });
                }
                return; // Saltar la ejecución
            }
            try {
                const processedRemote = await processRemoteOnce();
                if (processedRemote === 0) {
                    await runReportFlowAndNotify('auto');
                }
                // Reiniciar el countdown después de la ejecución
                remainingSeconds = intervalSec;
                if (mainWindow) {
                    mainWindow.webContents.send('auto-timer-update', {
                        remaining: remainingSeconds,
                        configured: intervalSec
                    });
                }
            }
            catch (e) {
                // Capturar error específico de MP_ACCESS_TOKEN y mostrar mensaje amigable
                if (e.message && e.message.includes('MP_ACCESS_TOKEN')) {
                    const userMessage = '❌ Error: Comprobar la cuenta de Mercado Pago. Ve a Configuración → Mercado Pago y verifica el Access Token.';
                    if (mainWindow) {
                        mainWindow.webContents.send('auto-report-notice', { error: userMessage });
                    }
                    (0, LogService_1.logError)('Error de configuración Mercado Pago', { message: userMessage });
                    (0, ErrorNotificationService_1.recordError)('MP_CONFIG', 'Error de configuración Mercado Pago', { message: userMessage });
                }
                else {
                    // Para otros errores, mantener el comportamiento original
                    if (mainWindow)
                        mainWindow.webContents.send('auto-report-notice', { error: String(e?.message || e) });
                }
            }
        }, Math.max(1000, intervalSec * 1000));
        // Iniciar countdown
        startCountdown(intervalSec);
        autoActive = true;
        autoPaused = false;
        return true;
    }
    electron_1.ipcMain.handle('auto-start', async () => {
        const okAuto = await startAutoTimer();
        // Si no hay intervalo global, intentar al menos encender timers remoto/imagen
        const okRemote = startRemoteTimer() === true;
        const okImage = startImageTimer() === true;
        return { ok: okAuto || okRemote || okImage };
    });
    electron_1.ipcMain.handle('auto-stop', async () => {
        stopAutoTimer();
        autoActive = false;
        autoPaused = false;
        remainingSeconds = 0;
        return { ok: true };
    });
    electron_1.ipcMain.handle('auto-status', async () => {
        return { active: autoActive, paused: autoPaused };
    });
    // Nuevos handlers para pausar/reanudar
    electron_1.ipcMain.handle('auto-pause', async () => {
        if (autoTimer) {
            clearInterval(autoTimer);
            autoTimer = null;
        }
        if (countdownTimer) {
            clearInterval(countdownTimer);
            countdownTimer = null;
        }
        autoActive = false;
        autoPaused = true;
        // Guardar estado de pausa
        store.set('autoPaused', true);
        store.set('remainingSeconds', remainingSeconds);
        return { ok: true, remaining: remainingSeconds };
    });
    electron_1.ipcMain.handle('auto-resume', async () => {
        const cfg = store.get('config') || {};
        const intervalSec = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
        if (!Number.isFinite(intervalSec) || intervalSec <= 0)
            return { ok: false, error: 'No hay intervalo configurado' };
        // Si no hay tiempo restante, usar el intervalo completo
        if (remainingSeconds <= 0) {
            remainingSeconds = intervalSec;
        }
        await startAutoTimer();
        store.set('autoPaused', false);
        return { ok: true, remaining: remainingSeconds };
    });
    electron_1.ipcMain.handle('auto-get-timer', async () => {
        const cfg = store.get('config') || {};
        const configuredSeconds = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
        return {
            configured: configuredSeconds,
            remaining: remainingSeconds,
            active: autoActive,
            paused: autoPaused
        };
    });
    // Opcional: arrancar timers si hay configuración previa
    const cfg0 = store.get('config') || {};
    if (Number(cfg0.AUTO_INTERVAL_SECONDS || 0) > 0) {
        // Restaurar estado de pausa si existía
        const wasPaused = store.get('autoPaused');
        if (wasPaused) {
            autoPaused = true;
            remainingSeconds = Number(store.get('remainingSeconds') || 0);
        }
        else {
            startAutoTimer().catch(() => { });
        }
    }
    // Iniciar timers de remoto e imagen si hay configuración.
    startRemoteTimer();
    startImageTimer();
    // Iniciar watchers en tiempo real si están habilitados
    startRemoteWatcher();
    startImageWatcher();
    // ===== HANDLERS DE AUTENTICACIÓN =====
    // Verificar si el sistema está inicializado
    electron_1.ipcMain.handle('auth:is-initialized', () => {
        return AuthService_1.AuthService.isInitialized();
    });
    // Obtener política de contraseñas
    electron_1.ipcMain.handle('auth:get-policy', () => {
        return AuthService_1.AuthService.policy();
    });
    // Configurar administrador inicial
    electron_1.ipcMain.handle('auth:setup', async (_e, { username, password, secretPhrase }) => {
        try {
            await AuthService_1.AuthService.setup(username, password, secretPhrase);
            return { ok: true };
        }
        catch (error) {
            (0, LogService_1.logAuth)('Error en configuración inicial', { error: error.message });
            throw error;
        }
    });
    // Login
    electron_1.ipcMain.handle('auth:login', async (_e, { username, password }) => {
        try {
            const result = await AuthService_1.AuthService.login(username, password);
            return result;
        }
        catch (error) {
            (0, LogService_1.logAuth)('Error en inicio de sesión', { error: error.message });
            return { ok: false, reason: 'error' };
        }
    });
    // Cambiar contraseña
    electron_1.ipcMain.handle('auth:change', async (_e, { current, newPw, newUser, newSecret }) => {
        try {
            await AuthService_1.AuthService.changePassword(current, newPw, newUser, newSecret);
            return { ok: true };
        }
        catch (error) {
            (0, LogService_1.logAuth)('Error en cambio de contraseña', { error: error.message });
            throw error;
        }
    });
    // Reset por frase secreta
    electron_1.ipcMain.handle('auth:reset-by-secret', async (_e, { secretPhrase, newPw, newUser }) => {
        try {
            await AuthService_1.AuthService.resetBySecret(secretPhrase, newPw, newUser);
            return { ok: true };
        }
        catch (error) {
            (0, LogService_1.logAuth)('Error en reset por frase secreta', { error: error.message });
            throw error;
        }
    });
    // Solicitar OTP
    electron_1.ipcMain.handle('auth:request-otp', async () => {
        try {
            const cfg = store.get('config') || {};
            const email = cfg.EMAIL_REPORT;
            if (!email)
                throw new Error('no_email');
            return OtpService_1.OtpService.createAndSend(email);
        }
        catch (error) {
            (0, LogService_1.logAuth)('Error en solicitud de OTP', { error: error.message });
            throw error;
        }
    });
    // Reset por OTP
    electron_1.ipcMain.handle('auth:reset-by-otp', async (_e, { otp, newPw, newUser }) => {
        try {
            if (!OtpService_1.OtpService.validate(otp))
                throw new Error('invalid_otp');
            await AuthService_1.AuthService.resetByOtp(newPw, newUser);
            return { ok: true };
        }
        catch (error) {
            (0, LogService_1.logAuth)('Error en reset por OTP', { error: error.message });
            throw error;
        }
    });
    // Abrir config.html después del login exitoso
    electron_1.ipcMain.handle('auth:open-config', async () => {
        if (mainWindow) {
            const target = path_1.default.join(electron_1.app.getAppPath(), 'public', 'config.html');
            console.log('[main] auth successful → loading config.html');
            // Ajustar tamaño para config
            try {
                mainWindow.setMinimumSize(900, 600);
                mainWindow.setSize(1200, 768);
                mainWindow.setMenuBarVisibility(false);
                mainWindow.setAutoHideMenuBar(true);
                try {
                    mainWindow.center();
                }
                catch { }
            }
            catch { }
            await mainWindow.loadFile(target);
            console.log('[main] config.html loaded');
            return { ok: true };
        }
        return { ok: false };
    });
    // ===== HANDLERS DE NOTIFICACIONES DE ERROR =====
    // Obtener configuración de notificaciones de error
    electron_1.ipcMain.handle('error-notifications:get-config', () => {
        return (0, ErrorNotificationService_1.getErrorNotificationConfig)();
    });
    // ===== HANDLERS DE PERFILES =====
    electron_1.ipcMain.handle('perfiles:list', async () => {
        try {
            const rows = (0, DbService_1.getDb)().listPerfiles();
            return { ok: true, rows };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('perfiles:get', async (_e, id) => {
        try {
            const row = (0, DbService_1.getDb)().getPerfil(Number(id));
            return { ok: true, row };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('perfiles:save', async (_e, perfil) => {
        try {
            const id = (0, DbService_1.getDb)().savePerfil(perfil);
            return { ok: true, id };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('perfiles:delete', async (_e, id) => {
        try {
            const ok = (0, DbService_1.getDb)().deletePerfil(Number(id));
            return { ok };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    // Actualizar configuración de notificaciones de error
    electron_1.ipcMain.handle('error-notifications:update-config', async (_e, config) => {
        try {
            (0, ErrorNotificationService_1.updateErrorNotificationConfig)(config);
            return { ok: true };
        }
        catch (error) {
            (0, LogService_1.logError)('Error al actualizar configuración de notificaciones', { error: error.message });
            return { ok: false, error: error.message };
        }
    });
    // Obtener resumen de errores
    electron_1.ipcMain.handle('error-notifications:get-summary', () => {
        return (0, ErrorNotificationService_1.getErrorSummary)();
    });
    // Limpiar errores antiguos
    electron_1.ipcMain.handle('error-notifications:clear-old', async (_e, hours = 24) => {
        try {
            (0, ErrorNotificationService_1.clearOldErrors)(hours);
            return { ok: true };
        }
        catch (error) {
            (0, LogService_1.logError)('Error al limpiar errores antiguos', { error: error.message });
            return { ok: false, error: error.message };
        }
    });
    // Resetear todas las notificaciones
    electron_1.ipcMain.handle('error-notifications:reset', async () => {
        try {
            (0, ErrorNotificationService_1.resetErrorNotifications)();
            return { ok: true };
        }
        catch (error) {
            (0, LogService_1.logError)('Error al resetear notificaciones', { error: error.message });
            return { ok: false, error: error.message };
        }
    });
    // ===== HANDLERS DE MODO IMAGEN =====
    // Probar lectura del archivo de control
    electron_1.ipcMain.handle('image:test-control', async () => {
        try {
            const cfg = store.get('config') || {};
            const controlDir = String(cfg.IMAGE_CONTROL_DIR || 'C:\\tmp');
            const controlFile = String(cfg.IMAGE_CONTROL_FILE || 'direccion.txt');
            const controlPath = path_1.default.join(controlDir, controlFile);
            if (!fs_1.default.existsSync(controlPath)) {
                return { success: false, error: 'Archivo de control no encontrado' };
            }
            const content = fs_1.default.readFileSync(controlPath, 'utf8').trim();
            if (!content) {
                return { success: false, error: 'Archivo de control vacío' };
            }
            // Extraer la ruta del contenido (soporta formato "URI=ruta" o solo "ruta")
            let filePath = content;
            if (content.startsWith('URI=')) {
                filePath = content.substring(4).trim();
            }
            // Verificar si el archivo existe
            if (!fs_1.default.existsSync(filePath)) {
                return { success: false, error: 'Archivo de contenido no encontrado' };
            }
            return { success: true, filePath };
        }
        catch (error) {
            (0, LogService_1.logError)('Error al probar archivo de control de imagen', { error: error.message });
            return { success: false, error: error.message };
        }
    });
    // Abrir archivo con la app del sistema (visor)
    electron_1.ipcMain.handle('image:open-external', async (_e, fullPath) => {
        try {
            await electron_1.shell.openPath(fullPath);
            return true;
        }
        catch {
            return false;
        }
    });
    // ===== HANDLERS DE LICENCIA =====
    electron_1.ipcMain.handle('license:status', async () => {
        return { ok: (0, licencia_1.licenciaExisteYValida)() };
    });
    // ===== HANDLERS FTP SERVER =====
    electron_1.ipcMain.handle('ftp-server:start', async (_e, cfg) => {
        try {
            const ok = await (0, FtpServerService_1.startFtpServer)(cfg || {});
            return { ok };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('ftp-server:stop', async () => {
        try {
            const ok = await (0, FtpServerService_1.stopFtpServer)();
            return { ok };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    electron_1.ipcMain.handle('ftp-server:status', async () => {
        return { running: (0, FtpServerService_1.isFtpServerRunning)() };
    });
    electron_1.ipcMain.handle('license:validate', async (_e, { nombreCliente, palabraSecreta, serial }) => {
        return { ok: (0, licencia_1.validarSerial)(nombreCliente || '', palabraSecreta || '', serial || '') };
    });
    electron_1.ipcMain.handle('license:save', async (_e, { nombreCliente, serial, palabraSecreta }) => {
        return (0, licencia_1.guardarLicencia)(nombreCliente, serial, palabraSecreta);
    });
    electron_1.ipcMain.handle('license:load', async () => {
        return (0, licencia_1.cargarLicencia)();
    });
    electron_1.ipcMain.handle('license:recover', async (_e, { nombreCliente, palabraSecreta }) => {
        return (0, licencia_1.recuperarSerial)(nombreCliente, palabraSecreta);
    });
    electron_1.ipcMain.handle('license:open-home', async () => {
        if (!mainWindow)
            return { ok: false };
        try {
            const cfg = store.get('config') || {};
            let defaultView = cfg?.DEFAULT_VIEW === 'config' ? 'config' : 'caja';
            const file = (defaultView ?? 'caja') === 'caja' ? 'caja.html' : 'config.html';
            const target = path_1.default.join(electron_1.app.getAppPath(), 'public', file);
            if (defaultView === 'caja') {
                try {
                    mainWindow.setMinimumSize(420, 320);
                    mainWindow.setSize(420, 320);
                    mainWindow.setMenuBarVisibility(false);
                    mainWindow.setAutoHideMenuBar(true);
                    try {
                        mainWindow.center();
                    }
                    catch { }
                }
                catch { }
            }
            else {
                try {
                    mainWindow.setMinimumSize(900, 600);
                    mainWindow.setSize(1200, 768);
                    mainWindow.setMenuBarVisibility(false);
                    mainWindow.setAutoHideMenuBar(true);
                    try {
                        mainWindow.center();
                    }
                    catch { }
                }
                catch { }
            }
            await mainWindow.loadFile(target);
            return { ok: true };
        }
        catch (e) {
            return { ok: false, error: String(e?.message || e) };
        }
    });
    // ===== HANDLERS GALICIA =====
    electron_1.ipcMain.handle('galicia:get-saldos', async () => {
        try {
            const saldos = await (0, GaliciaService_1.getGaliciaSaldos)();
            return { success: true, data: saldos };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('galicia:get-movimientos', async () => {
        try {
            const movimientos = await (0, GaliciaService_1.getGaliciaMovimientos)();
            return { success: true, data: movimientos };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('galicia:crear-cobranza', async (_e, data) => {
        try {
            const cobranzaId = await (0, GaliciaService_1.crearGaliciaCobranza)(data);
            return { success: true, data: { id: cobranzaId } };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('galicia:get-cobros', async () => {
        try {
            const cobros = await (0, GaliciaService_1.getGaliciaCobros)();
            return { success: true, data: cobros };
        }
        catch (error) {
            return { success: false, error: error.message };
        }
    });
    electron_1.ipcMain.handle('galicia:test-connection', async () => {
        try {
            const result = await (0, GaliciaService_1.testGaliciaConnection)();
            return result;
        }
        catch (error) {
            return { success: false, message: error.message };
        }
    });
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
