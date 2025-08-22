import { app, BrowserWindow, ipcMain, shell, dialog, Tray, Menu, nativeImage, screen, Notification } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Store from 'electron-store';
import cron from 'node-cron';
import { autoUpdater } from 'electron-updater';
import dotenv from 'dotenv';
dotenv.config();
import { searchPaymentsWithConfig, testConnection } from './services/MercadoPagoService';
import { startFtpServer, stopFtpServer, isFtpServerRunning } from './services/FtpServerService';
import { generateFiles, getOutDir } from './services/ReportService';
import { testFtp, sendTodayDbf, sendDbf, sendArbitraryFile } from './services/FtpService';
import { sendReportEmail } from './services/EmailService';
import { logInfo, logSuccess, logError, logWarning, logMp, logFtp, logAuth, getTodayLogPath, ensureLogsDir, ensureTodayLogExists } from './services/LogService';
import { recordError, getErrorNotificationConfig, updateErrorNotificationConfig, getErrorSummary, clearOldErrors, resetErrorNotifications } from './services/ErrorNotificationService';
import { AuthService } from './services/AuthService';
import { OtpService } from './services/OtpService';
import { licenciaExisteYValida, validarSerial, guardarLicencia, cargarLicencia, recuperarSerial } from './utils/licencia';
import { getDb } from './services/DbService';
import { getFacturacionService } from './services/FacturacionService';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;
let currentViewName: 'config' | 'caja' | 'imagen' = 'caja';
// Ventana persistente para presentaciones (comun12)
let imageDualWindow: BrowserWindow | null = null;
// Ventana 'nueva' (reutilizable bajo política de Producto Nuevo)
let lastImageNewWindow: BrowserWindow | null = null;
let lastImageNewWindowAt = 0; // epoch ms

// Publicidad (presentación pantalla completa) para ventana espejo
function isPublicidadAllowed(): boolean {
    try {
        const cfg: any = store.get('config') || {};
        return cfg.IMAGE_PUBLICIDAD_ALLOWED === true;
    } catch { return false; }
}
function isPublicidadActive(): boolean {
    try { return isPublicidadAllowed() && ((store.get('publicidadOn') as any) === true); } catch { return false; }
}
function setPublicidadActive(on: boolean) {
    try { (store as any).set('publicidadOn', !!on); } catch {}
    try { refreshTrayMenu(); } catch {}
    // Aplicar al vuelo sobre la ventana espejo si existe
    try {
        if (imageDualWindow && !imageDualWindow.isDestroyed()) {
            const active = isPublicidadActive();
            try { imageDualWindow.setFullScreenable(true); } catch {}
            if (active) {
                try { imageDualWindow.setKiosk(true); } catch {}
                try { imageDualWindow.setAlwaysOnTop(true, 'screen-saver'); } catch {}
                try { imageDualWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
                try { imageDualWindow.setFullScreen(true); } catch {}
            } else {
                try { imageDualWindow.setKiosk(false); } catch {}
                try { imageDualWindow.setAlwaysOnTop(false); } catch {}
                try { imageDualWindow.setVisibleOnAllWorkspaces(false); } catch {}
                try { imageDualWindow.setFullScreen(false); } catch {}
            }
            try { imageDualWindow.webContents.send('image:publicidad-mode', { on: active }); } catch {}
        }
    } catch {}
}

// Guardar tamaño/posición de la ventana secundaria (comun12)
function saveImageDualWindowBounds() {
	try {
		if (!imageDualWindow) return;
		const bounds = imageDualWindow.getBounds();
		const display = screen.getDisplayMatching(bounds);
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
		try { (store as any).set('imageDualWindowMaximized', !!imageDualWindow.isMaximized()); } catch {}
	} catch {}
}

function restoreImageDualWindowBounds(win: BrowserWindow, minWidth = 420, minHeight = 420): boolean {
	try {
		const saved = store.get('imageDualWindowBounds') as { x: number; y: number; width: number; height: number; workW?: number; workH?: number; workX?: number; workY?: number; displayId?: number } | undefined;
		if (!saved || saved.x === undefined || saved.y === undefined || !saved.width || !saved.height) return false;
		const displays = screen.getAllDisplays();
		let target = saved.displayId !== undefined ? displays.find(d => d.id === saved.displayId) : undefined;
		if (!target) {
			// fallback: buscar por área donde estaba; si no, primario
			target = screen.getDisplayMatching({ x: saved.x, y: saved.y, width: saved.width, height: saved.height }) || screen.getPrimaryDisplay();
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
			const wasMax = (store.get('imageDualWindowMaximized') as any) === true;
			if (wasMax && !isPublicidadActive()) win.maximize();
		} catch {}
		return true;
	} catch { return false; }
}

// Persistencia para ventanas creadas con VENTANA=nueva
function saveImageNewWindowBounds(win: BrowserWindow | null) {
    try {
        if (!win) return;
        const bounds = win.getBounds();
        const display = screen.getDisplayMatching(bounds);
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
    } catch {}
}

function restoreImageNewWindowBounds(win: BrowserWindow, minWidth = 420, minHeight = 420): boolean {
    try {
        const saved = store.get('imageNewWindowBounds') as { x: number; y: number; width: number; height: number; workW?: number; workH?: number; workX?: number; workY?: number; displayId?: number } | undefined;
        if (!saved || saved.x === undefined || saved.y === undefined || !saved.width || !saved.height) return false;
        const displays = screen.getAllDisplays();
        let target = saved.displayId !== undefined ? displays.find(d => d.id === saved.displayId) : undefined;
        if (!target) {
            target = screen.getDisplayMatching({ x: saved.x, y: saved.y, width: saved.width, height: saved.height }) || screen.getPrimaryDisplay();
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
    } catch { return false; }
}

// Limpia artefactos previos del updater que pueden producir EPERM al renombrar
function cleanupUpdaterPendingDir(): void {
    try {
        if (process.platform !== 'win32') return;
        const local = process.env.LOCALAPPDATA;
        if (!local) return;
        const pendingDir = path.join(local, 'tc-mp-updater', 'pending');
        if (!fs.existsSync(pendingDir)) return;
        const files = fs.readdirSync(pendingDir);
        for (const f of files) {
            try {
                const lower = f.toLowerCase();
                if (lower.endsWith('.exe') || lower.endsWith('.zip') || lower.includes('tc-mp')) {
                    fs.rmSync(path.join(pendingDir, f), { force: true });
                }
            } catch {}
        }
    } catch {}
}

function getTrayImage() {
	try {
		const candidates = [
			// Preferir icono del ejecutable en Windows (suele existir y verse bien)
			process.platform === 'win32' ? process.execPath : '',
			// Icono provisto por el proyecto
			path.join(app.getAppPath(), 'build', 'icon.ico'),
			path.join(app.getAppPath(), 'public', 'icon.png'),
			path.join(app.getAppPath(), 'public', 'icon.ico'),
			path.join(app.getAppPath(), 'icon.png'),
			path.join(process.resourcesPath || '', 'icon.png'),
			path.join(process.resourcesPath || '', 'build', 'icon.ico')
		];
		for (const p of candidates) {
			try {
				if (!p) continue;
				let img = nativeImage.createFromPath(p);
				if (!img.isEmpty()) {
					// Ajustar tamaño para bandeja en Windows para evitar icono invisible/borroso
					if (process.platform === 'win32') {
						img = img.resize({ width: 16, height: 16 });
					}
					return img;
				}
			} catch {}
		}
		// Último recurso: usar icono del proceso (no siempre disponible) o un vacío
		const procImg = nativeImage.createFromPath(process.execPath);
		if (!procImg.isEmpty()) {
			return process.platform === 'win32' ? procImg.resize({ width: 16, height: 16 }) : procImg;
		}
		return nativeImage.createEmpty();
	} catch {
		return nativeImage.createEmpty();
	}
}

async function openViewFromTray(view: 'config' | 'caja' | 'imagen') {
	if (!mainWindow) return;
	// Asegurar que la ventana esté visible (fuera de bandeja) antes de cambiar la vista
	showMainWindow();
	if (view === 'config') {
		currentViewName = 'config';
		(store as any).set('lastView', 'config');
		const target = path.join(app.getAppPath(), 'public', 'auth.html');
		try {
			mainWindow.setMinimumSize(500, 400);
			mainWindow.setSize(500, 400);
			mainWindow.setMenuBarVisibility(false);
			mainWindow.setAutoHideMenuBar(true);
			try { mainWindow.center(); } catch {}
		} catch {}
		await mainWindow.loadFile(target);
		return;
	} else if (view === 'caja') {
		// caja
		currentViewName = 'caja';
		(store as any).set('lastView', 'caja');
		const target = path.join(app.getAppPath(), 'public', 'caja.html');
		try {
			mainWindow.setMinimumSize(420, 320);
			// Restaurar posición previa; si no existe, usar tamaño mínimo y centrar
			if (!restoreCajaWindowPosition(420, 320)) {
				mainWindow.setSize(420, 320);
				try { mainWindow.center(); } catch {}
			}
			mainWindow.setMenuBarVisibility(false);
			mainWindow.setAutoHideMenuBar(true);
		} catch {}
		await mainWindow.loadFile(target);
	} else if (view === 'imagen') {
		// imagen
		currentViewName = 'imagen';
		(store as any).set('lastView', 'imagen');
		const target = path.join(app.getAppPath(), 'public', 'imagen.html');
		try {
			mainWindow.setMinimumSize(420, 420);
			// Intentar restaurar tamaño/posición previo de imagen; si no, usar 420x420 centrado
			if (!restoreImagenWindowBounds(420, 420)) {
				mainWindow.setSize(420, 420);
				try { mainWindow.center(); } catch {}
			}
			mainWindow.setMenuBarVisibility(false);
			mainWindow.setAutoHideMenuBar(true);
		} catch {}
		await mainWindow.loadFile(target);
	}
}

function showMainWindow() {
	if (!mainWindow) return;
	try { mainWindow.setSkipTaskbar(false); } catch {}
	mainWindow.show();
	mainWindow.focus();
}

function hideToTray() {
	if (!mainWindow) return;
	try { mainWindow.setSkipTaskbar(true); } catch {}
	mainWindow.hide();
}

function buildTrayMenu() {
    const publicidadAllowed = isPublicidadAllowed();
    const publicidadChecked = isPublicidadActive();
    const cfg: any = store.get('config') || {};
    const activePerms: any = (cfg as any).ACTIVE_PERFIL_PERMISOS || {};
    const perfilNombre: string = String((cfg as any).ACTIVE_PERFIL_NOMBRE || '');
    const cajaDisabled = activePerms && activePerms.caja === false;
    const estadoLabel = perfilNombre ? `Perfil: ${perfilNombre}` : 'Perfil: (sin aplicar)';
    const template: Electron.MenuItemConstructorOptions[] = [
        { label: estadoLabel, enabled: false },
        { type: 'separator' },
        { label: 'Mostrar', click: () => showMainWindow() },
        { type: 'separator' },
        { label: perfilNombre ? `Ir a Caja${cajaDisabled ? ' (bloqueado por perfil)' : ''}` : 'Ir a Caja', enabled: !cajaDisabled, click: () => openViewFromTray('caja') },
        { label: 'Ir a Imagen', click: () => openViewFromTray('imagen') },
        { label: 'Ir a Configuración', click: () => openViewFromTray('config') },
        { type: 'separator' },
        { label: 'Publicidad', type: 'checkbox', enabled: publicidadAllowed, checked: publicidadChecked, click: (item) => {
            setPublicidadActive((item as any).checked === true);
        } },
        { label: 'Resetear posición/tamaño (ventana actual)', click: async () => {
            try {
                if (!mainWindow) return;
                if (currentViewName === 'imagen') {
                    (store as any).delete('imagenWindowBounds');
                    mainWindow.setSize(420, 420);
                    try { mainWindow.center(); } catch {}
                } else if (currentViewName === 'caja') {
                    (store as any).delete('cajaWindowBounds');
                    mainWindow.setSize(420, 320);
                    try { mainWindow.center(); } catch {}
                } else {
                    // Administración/login
                    mainWindow.setSize(500, 400);
                    try { mainWindow.center(); } catch {}
                }
            } catch {}
        }},
        { type: 'separator' },
        { label: 'Salir', click: () => { isQuitting = true; app.quit(); } }
    ];
    return Menu.buildFromTemplate(template);
}

function refreshTrayMenu() {
    try { if (tray) tray.setContextMenu(buildTrayMenu()); } catch {}
}

function createTray() {
	if (tray) return;
	tray = new Tray(getTrayImage());
	try { tray.setToolTip('MP'); } catch {}
	tray.on('click', () => {
		if (!mainWindow) return;
		if (mainWindow.isVisible()) hideToTray();
		else showMainWindow();
	});
	refreshTrayMenu();
}

function saveCajaWindowPosition() {
	try {
		if (!mainWindow) return;
		const bounds = mainWindow.getBounds();
		const display = screen.getDisplayMatching(bounds);
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
	} catch {}
}

function restoreCajaWindowPosition(minWidth = 420, minHeight = 320) {
	try {
		const saved = store.get('cajaWindowBounds') as { x: number; y: number; width?: number; height?: number; workW?: number; workH?: number; workX?: number; workY?: number; displayId?: number } | undefined;
		if (!saved || saved.x === undefined || saved.y === undefined) return false;
		const displays = screen.getAllDisplays();
		let target = saved.displayId !== undefined ? displays.find(d => d.id === saved.displayId) : undefined;
		if (!target) {
			target = screen.getDisplayMatching({ x: saved.x, y: saved.y, width: saved.width || minWidth, height: saved.height || minHeight }) || screen.getPrimaryDisplay();
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
		if (mainWindow) mainWindow.setBounds({ x, y, width: w, height: h });
		return true;
	} catch { return false; }
}

// Guardar tamaño/posición para vista imagen en ventana principal
function saveImagenWindowBounds() {
    try {
        if (!mainWindow) return;
        const bounds = mainWindow.getBounds();
        const display = screen.getDisplayMatching(bounds);
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
    } catch {}
}

function restoreImagenWindowBounds(minWidth = 420, minHeight = 420) {
    try {
        const saved = store.get('imagenWindowBounds') as { x: number; y: number; width: number; height: number; workW?: number; workH?: number; workX?: number; workY?: number; displayId?: number } | undefined;
        if (!saved || saved.x === undefined || saved.y === undefined || !saved.width || !saved.height) return false;
        const displays = screen.getAllDisplays();
        let target = saved.displayId !== undefined ? displays.find(d => d.id === saved.displayId) : undefined;
        if (!target) {
            target = screen.getDisplayMatching({ x: saved.x, y: saved.y, width: saved.width, height: saved.height }) || screen.getPrimaryDisplay();
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
    } catch { return false; }
}

function getEncryptionKey(): string | undefined {
	const dir = app.getPath('userData');
	const keyPath = path.join(dir, 'config.key');
	try {
		if (fs.existsSync(keyPath)) {
			return fs.readFileSync(keyPath, 'utf8');
		}
		const key = crypto.randomBytes(32).toString('hex');
		fs.writeFileSync(keyPath, key, { mode: 0o600 });
		return key;
	} catch (e) {
		return undefined;
	}
}

function isWebUrl(value: string): boolean {
    try {
        if (!value || typeof value !== 'string') return false;
        const lower = value.trim().toLowerCase();
        if (lower.startsWith('http://') || lower.startsWith('https://')) return true;
        // URL constructor puede lanzar en Windows con rutas locales; usar chequeo simple
        return false;
    } catch { return false; }
}

// (revertido) normalización de rutas eliminada a pedido del cliente

let store: Store<{ config?: Record<string, unknown> }>;
try {
    store = new Store<{ config?: Record<string, unknown> }>({ name: 'settings', encryptionKey: getEncryptionKey() });
} catch (e: any) {
    try {
        const dir = app.getPath('userData');
        const storePath = path.join(dir, 'settings.json');
        const backupPath = path.join(dir, `settings.bak-${Date.now()}.json`);
        if (fs.existsSync(storePath)) {
            fs.renameSync(storePath, backupPath);
            try { logWarning('Config corrupta detectada, creando backup y reestableciendo', { storePath, backupPath }); } catch {}
        }
    } catch {}
    // Reintentar creación del store
    store = new Store<{ config?: Record<string, unknown> }>({ name: 'settings', encryptionKey: getEncryptionKey() });
}

function createMainWindow() {
	mainWindow = new BrowserWindow({
		width: 1000,
		height: 700,
		webPreferences: {
			preload: path.join(__dirname, 'preload.js'),
			contextIsolation: true,
			nodeIntegration: false,
			devTools: true
		}
	});

	// En build, __dirname apunta a dist/src; public queda al lado de dist
	const cfg: any = store.get('config') || {};
	// Elegir vista inicial: priorizar la última vista usada; si no existe, usar DEFAULT_VIEW y por defecto 'caja'
	const lastView = (store.get('lastView') as any) as 'config' | 'caja' | 'imagen' | undefined;
	let defaultView: 'config' | 'caja' | 'imagen' = ((): any => {
		if (lastView === 'config' || lastView === 'caja' || lastView === 'imagen') return lastView;
		const v = String(cfg?.DEFAULT_VIEW || '').toLowerCase();
		if (v === 'config') return 'config';
		if (v === 'imagen') return 'imagen';
		return 'caja';
	})();
	// Si la vista por defecto es administración (config), forzar autenticación previa
	const initialFile = defaultView === 'caja' ? 'caja.html' : (defaultView === 'imagen' ? 'imagen.html' : 'auth.html');
	currentViewName = defaultView;

	// Inicializar DB de facturación al inicio
	try { getDb(); } catch (e) { console.warn('DB init error', e); }

	// Bypass de licencia en desarrollo si SKIP_LICENSE=true o flag --skip-license
	const devBypass = (!app.isPackaged) && (String(process.env.SKIP_LICENSE).toLowerCase() === 'true' || process.argv.includes('--skip-license'));

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
				try { mainWindow.center(); } catch {}
			}
		} else if (defaultView === 'imagen') {
			mainWindow.setMinimumSize(420, 420);
			mainWindow.setMenuBarVisibility(false);
			mainWindow.setAutoHideMenuBar(true);
			if (!restoreImagenWindowBounds(420, 420)) {
				mainWindow.setSize(420, 420);
				try { mainWindow.center(); } catch {}
			}
		} else {
			// Administración: iniciar siempre en pantalla de autenticación
			mainWindow.setMinimumSize(500, 400);
			mainWindow.setSize(500, 400);
			mainWindow.setMenuBarVisibility(false);
			mainWindow.setAutoHideMenuBar(true);
			try { mainWindow.center(); } catch {}
		}
	} catch {}

	// Gate de licencia: si no existe/vale y no estamos en bypass, mostrar licencia.html
	if (!devBypass) {
		try {
			const licOk = licenciaExisteYValida();
			if (!licOk) {
				const licPath = path.join(app.getAppPath(), 'public', 'licencia.html');
				// Asegurar tamaño cómodo para el formulario de licencia
				try {
					mainWindow.setMinimumSize(700, 760);
					mainWindow.setSize(800, 820);
					mainWindow.setMenuBarVisibility(false);
					mainWindow.setAutoHideMenuBar(true);
					try { mainWindow.center(); } catch {}
				} catch {}
				mainWindow.loadFile(licPath);
				return;
			}
		} catch {
			const licPath = path.join(app.getAppPath(), 'public', 'licencia.html');
			try {
				mainWindow.setMinimumSize(700, 760);
				mainWindow.setSize(800, 820);
				mainWindow.setMenuBarVisibility(false);
				mainWindow.setAutoHideMenuBar(true);
				try { mainWindow.center(); } catch {}
			} catch {}
			mainWindow.loadFile(licPath);
			return;
		}
	}

	// Si bypass o licencia válida, cargar vista inicial
	const htmlPath = path.join(app.getAppPath(), 'public', initialFile);
	mainWindow.loadFile(htmlPath);

	// Minimizar a bandeja (Windows)
	mainWindow.on('minimize', (e) => {
		try { e.preventDefault(); } catch {}
		saveCajaWindowPosition();
		hideToTray();
	});
	mainWindow.on('close', (e) => {
		if (isQuitting) return;
		try { e.preventDefault(); } catch {}
		saveCajaWindowPosition();
		hideToTray();
	});
	mainWindow.on('show', () => {
		try { mainWindow?.setSkipTaskbar(false); } catch {}
	});

	// Guardar posición de la ventana cuando se mueve (solo para modo caja)
	mainWindow.on('moved', () => {
		if (currentViewName === 'caja') {
			saveCajaWindowPosition();
		} else if (currentViewName === 'imagen') {
			saveImagenWindowBounds();
		}
	});

	mainWindow.on('resize', () => {
		if (currentViewName === 'caja') {
			saveCajaWindowPosition();
		} else if (currentViewName === 'imagen') {
			saveImagenWindowBounds();
		}
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}
function notifySystem(title: string, body: string) {
	try {
		if (Notification.isSupported()) {
			new Notification({ title, body, silent: false }).show();
		}
	} catch {}
}

// Desactivar aceleración por GPU (mejora compatibilidad en WSL/VMs)
app.disableHardwareAcceleration();

// Instancia única: evita múltiples procesos y enfoca la ventana existente
const gotTheLock = app.requestSingleInstanceLock();
if (!gotTheLock) {
    app.quit();
} else {
    app.on('second-instance', () => {
        try {
            if (mainWindow) {
                try { if (mainWindow.isMinimized()) mainWindow.restore(); } catch {}
                showMainWindow();
            } else {
                createMainWindow();
            }
        } catch {}
    });
}

app.whenReady().then(() => {
    ensureLogsDir();
    ensureTodayLogExists();
    try { Menu.setApplicationMenu(null); } catch {}

    // Autoarranque FTP Server si está habilitado
    try {
        const cfg: any = store.get('config') || {};
        if (cfg.FTP_SRV_ENABLED) {
            startFtpServer({
                host: cfg.FTP_SRV_HOST || '0.0.0.0',
                port: Number(cfg.FTP_SRV_PORT || 2121),
                user: cfg.FTP_SRV_USER || 'user',
                pass: cfg.FTP_SRV_PASS || 'pass',
                root: cfg.FTP_SRV_ROOT || 'C:\\tmp\\ftp_share'
            }).then((ok) => { if (ok) logInfo('FTP auto-start OK'); else logWarning('FTP auto-start failed'); }).catch(()=>{});
        }
    } catch {}

    // ===== AUTO-UPDATE (electron-updater) =====
    try {
        const ghToken = process.env.GH_TOKEN || '';
        if (ghToken) {
            (autoUpdater as any).requestHeaders = { Authorization: `token ${ghToken}` };
        }
        autoUpdater.autoDownload = false;

        autoUpdater.on('error', (error) => {
            try { logError('AutoUpdate error', { message: String((error as any)?.message || error) }); } catch {}
            try { mainWindow?.setProgressBar(-1); } catch {}
        });

        autoUpdater.on('update-available', async (info) => {
            try {
                const result = await dialog.showMessageBox(mainWindow ?? undefined, {
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
                        try { mainWindow?.setProgressBar(0.01); } catch {}
                        await autoUpdater.downloadUpdate();
                    } catch (e) {
                        try { logError('AutoUpdate download failed', { message: String((e as any)?.message || e) }); } catch {}
                        try { mainWindow?.setProgressBar(-1); } catch {}
                    }
                }
            } catch (e) {
                try { logError('AutoUpdate prompt failed', { message: String((e as any)?.message || e) }); } catch {}
            }
        });

        autoUpdater.on('download-progress', (progress) => {
            try {
                const percent = Number(progress?.percent || 0);
                mainWindow?.setProgressBar(Math.max(0, Math.min(1, percent / 100)));
                logInfo('AutoUpdate progress', {
                    percent: Math.round(percent * 10) / 10,
                    transferred: Number(progress?.transferred || 0),
                    total: Number(progress?.total || 0)
                });
            } catch {}
        });

        autoUpdater.on('update-downloaded', async () => {
            try {
                const result = await dialog.showMessageBox(mainWindow ?? undefined, {
                    type: 'info',
                    buttons: ['Reiniciar y actualizar', 'Después'],
                    defaultId: 0,
                    cancelId: 1,
                    title: 'Actualización lista',
                    message: 'La actualización está lista. ¿Desea reiniciar la aplicación para instalarla?'
                });
                if (result.response === 0) {
                    setImmediate(() => autoUpdater.quitAndInstall());
                }
                try { mainWindow?.setProgressBar(-1); } catch {}
            } catch (e) {
                try { logError('AutoUpdate restart prompt failed', { message: String((e as any)?.message || e) }); } catch {}
            }
        });

        // Buscar actualizaciones al inicio
        autoUpdater.checkForUpdates().catch((e) => {
            try { logWarning('AutoUpdate check failed', { message: String((e as any)?.message || e) }); } catch {}
        });
    } catch (e) {
        try { logWarning('AutoUpdate setup failed', { message: String((e as any)?.message || e) }); } catch {}
    }
	// IPC seguro para configuración
	ipcMain.handle('get-config', () => {
		return store.get('config') || {};
	});
	ipcMain.handle('save-config', (_event, cfg: Record<string, unknown>) => {
		if (cfg && typeof cfg === 'object') {
			store.set('config', cfg);
			// Refrescar menú de bandeja para reflejar cambios como IMAGE_PUBLICIDAD_ALLOWED
			try { refreshTrayMenu(); } catch {}
			// Reiniciar timers para aplicar cambios
			restartRemoteTimerIfNeeded();
			restartImageTimerIfNeeded();
			restartWatchersIfNeeded();
			return true;
		}
		return false;
	});

	ipcMain.handle('test-connection', async () => {
		return await testConnection();
	});

	// Validar existencia de carpeta remota (modo "remoto")
	ipcMain.handle('auto-remote:validate-dir', async (_e, dirPath: string) => {
		try {
			if (!dirPath || typeof dirPath !== 'string') return { ok: false, exists: false, isDir: false };
			const exists = fs.existsSync(dirPath);
			let isDir = false;
			if (exists) {
				try { isDir = fs.statSync(dirPath).isDirectory(); } catch {}
			}
			return { ok: true, exists, isDir };
		} catch (e: any) {
			return { ok: false, exists: false, isDir: false, error: String(e?.message || e) };
		}
	});

	// Generar reporte bajo demanda
	ipcMain.handle('generate-report', async () => {
		logInfo('Reporte manual solicitado');
		try {
			const res = await runReportFlowAndNotify('manual');
			return res;
		} catch (error: any) {
			// Capturar error específico de MP_ACCESS_TOKEN y mostrar mensaje amigable
			if (error.message && error.message.includes('MP_ACCESS_TOKEN')) {
				const userMessage = '❌ Error: Comprobar la cuenta de Mercado Pago. Ve a Configuración → Mercado Pago y verifica el Access Token.';
				if (mainWindow) {
					mainWindow.webContents.send('auto-report-notice', { error: userMessage });
				}
				logError('Error de configuración Mercado Pago', { message: userMessage });
				recordError('MP_CONFIG', 'Error de configuración Mercado Pago', { message: userMessage });
				notifySystem('MP – Configuración requerida', 'Verifica el Access Token en Configuración → Mercado Pago');
				throw new Error(userMessage);
			} else {
				const msg = String(error?.message || error);
				if (mainWindow) mainWindow.webContents.send('auto-report-notice', { error: msg });
				// Notificar caída de comunicación con MP
				recordError('MP_COMM', 'Fallo de comunicación con Mercado Pago', { message: msg });
				notifySystem('MP – Comunicación fallida', 'No se pudo consultar Mercado Pago. Revisa conexión y credenciales.');
				throw error;
			}
		}
	});

	// Export on-demand without re-fetch (assumes files already generated or uses latest payments)
	ipcMain.handle('export-report', async () => {
		const outDir = getOutDir();
		return { outDir };
	});

	// Versión de la app para mostrar en UI
	ipcMain.handle('get-app-version', async () => {
		try {
			return { version: app.getVersion() };
		} catch {
			return { version: 'unknown' };
		}
	});

	// ===== ABOUT: Release notes =====
	ipcMain.handle('about:get-release-notes', async () => {
		try {
			const p = path.join(app.getAppPath(), 'docs', 'RELEASE_NOTES.md');
			const exists = fs.existsSync(p);
			const content = exists ? fs.readFileSync(p, 'utf8') : 'No hay notas de versión disponibles.';
			return { ok: true, path: p, content };
		} catch (e: any) {
			return { ok: false, error: String(e?.message || e) };
		}
	});

	ipcMain.handle('send-report-email', async () => {
		const today = new Date().toISOString().slice(0, 10);
		const outDir = getOutDir();
		const files = [
			{ filename: `balance-${today}.json`, path: `${outDir}/balance-${today}.json` },
			{ filename: `transactions-${today}.csv`, path: `${outDir}/transactions-${today}.csv` },
			{ filename: `transactions-full-${today}.csv`, path: `${outDir}/transactions-full-${today}.csv` },
			{ filename: `transactions-full-${today}.xlsx`, path: `${outDir}/transactions-full-${today}.xlsx` },
			{ filename: `transactions-detailed-${today}.dbf`, path: `${outDir}/transactions-detailed-${today}.dbf` }
		].filter(f => fs.existsSync((f as any).path));
		const sent = await sendReportEmail(`MP Reporte ${today}`, `Adjunto reporte de ${today}`, files as any);
		return { sent, files: (files as any).map((f: any) => (f as any).filename) };
	});

	// FTP: probar conexión
	ipcMain.handle('test-ftp', async () => {
		try {
			const ok = await testFtp();
			return { ok };
		} catch (e: any) {
			return { ok: false, error: String(e?.message || e) };
		}
	});

	// FTP: enviar DBF del día
	ipcMain.handle('send-dbf-ftp', async () => {
		try {
			const res = await sendTodayDbf();
			return { ok: true, ...res };
		} catch (e: any) {
			return { ok: false, error: String(e?.message || e) };
		}
	});

	// FTP: enviar archivo arbitrario seleccionado en disco
	ipcMain.handle('ftp:send-file', async (_e, { localPath, remoteName }: { localPath: string; remoteName?: string }) => {
		try {
			if (!localPath) return { ok: false, error: 'Ruta local vacía' };
			const res = await sendArbitraryFile(localPath, remoteName);
			return { ok: true, ...res };
		} catch (e: any) {
			return { ok: false, error: String(e?.message || e) };
		}
	});

	// FTP: limpiar hash para forzar próximo envío
	ipcMain.handle('clear-ftp-hash', async () => {
		try {
			const { clearLastSentHash } = await import('./services/FtpService');
			clearLastSentHash();
			return { ok: true };
		} catch (e: any) {
			return { ok: false, error: String(e?.message || e) };
		}
	});

	// Abrir carpeta de salida
	ipcMain.handle('open-out-dir', async () => {
		const dir = getOutDir();
		await shell.openPath(dir);
		return { ok: true, dir };
	});

	// Abrir log del día
	ipcMain.handle('open-today-log', async () => {
		const p = getTodayLogPath();
		try {
			await shell.openPath(p);
			return { ok: true, path: p };
		} catch (e: any) {
			return { ok: false, error: String(e?.message || e), path: p };
		}
	});

	// Abrir ruta arbitraria (archivo/carpeta)
	ipcMain.handle('open-path', async (_e, fullPath: string) => {
		try {
			if (!fullPath) return { ok: false, error: 'Ruta vacía' };
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
				if (!fs.existsSync(target)) {
					fs.mkdirSync(target, { recursive: true });
				}
			} catch {}
			await shell.openPath(target);
			return { ok: true, path: target };
		} catch (e: any) {
			return { ok: false, error: String(e?.message || e) };
		}
	});

	// Listar historial simple por fecha (tags)
	ipcMain.handle('list-history', async () => {
		const dir = getOutDir();
		try {
			const entries = fs.existsSync(dir) ? fs.readdirSync(dir) : [];
			const map = new Map<string, string[]>();
			for (const name of entries) {
				const m = name.match(/^(balance|transactions|transactions-full|transactions-detailed)-([0-9]{4}-[0-9]{2}-[0-9]{2})\.(json|csv|xlsx|dbf)$/);
				if (!m) continue;
				const tag = m[2];
				const arr = map.get(tag) || [];
				arr.push(name);
				map.set(tag, arr);
			}
			const items = Array.from(map.entries()).sort((a,b)=>a[0]<b[0]?1:-1).map(([tag, files]) => ({ tag, files }));
			return { ok: true, dir, items };
		} catch (e: any) {
			return { ok: false, error: String(e?.message || e) };
		}
	});

	// Abrir vistas (config/caja/imagen)
	ipcMain.handle('open-view', async (_evt, view: 'config' | 'caja' | 'imagen') => {
		console.log('[main] open-view →', view);
		
		if (view === 'config') {
			// Para config, siempre abrir auth.html primero
			const authFile = 'auth.html';
			console.log('[main] config requested → loading auth.html');
			if (mainWindow) {
				const target = path.join(app.getAppPath(), 'public', authFile);
				console.log('[main] loading auth file:', target);
				// Ajustar tamaño para auth
				try {
					mainWindow.setMinimumSize(500, 400);
					mainWindow.setSize(500, 400);
					mainWindow.setMenuBarVisibility(false);
					mainWindow.setAutoHideMenuBar(true);
					try { mainWindow.center(); } catch {}
				} catch {}
				await mainWindow.loadFile(target);
				console.log('[main] auth.html loaded');
				return { ok: true };
			}
		} else if (view === 'caja') {
			// Para caja, abrir directamente
			const file = 'caja.html';
			console.log('[main] caja requested → loading caja.html');
			if (mainWindow) {
				currentViewName = 'caja';
				(store as any).set('lastView', 'caja');
				const target = path.join(app.getAppPath(), 'public', file);
				console.log('[main] loading file:', target);
				// Ajustar tamaño según vista
				try {
					mainWindow.setMinimumSize(420, 320);
					mainWindow.setSize(420, 320);
					mainWindow.setMenuBarVisibility(false);
					mainWindow.setAutoHideMenuBar(true);
					
					// Restaurar posición guardada para modo caja
					const savedPosition = store.get('cajaWindowBounds') as { x: number; y: number; width?: number; height?: number } | undefined;
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
					} else {
						// Si no hay posición guardada, centrar
						try { mainWindow.center(); } catch {}
					}
				} catch {}
				await mainWindow.loadFile(target);
				console.log('[main] loadFile done');
				return { ok: true };
			}
		} else if (view === 'imagen') {
			// Para imagen, abrir directamente
			const file = 'imagen.html';
			console.log('[main] imagen requested → loading imagen.html');
			if (mainWindow) {
				currentViewName = 'imagen';
				(store as any).set('lastView', 'imagen');
				const target = path.join(app.getAppPath(), 'public', file);
				console.log('[main] loading file:', target);
				// Ajustar tamaño/posición para modo imagen (restaurar bounds si existen)
				try {
					mainWindow.setMinimumSize(420, 420);
					mainWindow.setMenuBarVisibility(false);
					mainWindow.setAutoHideMenuBar(true);
					// Intentar restaurar tamaño/posición previa del modo imagen
					if (!restoreImagenWindowBounds(420, 420)) {
						mainWindow.setSize(420, 420);
						try { mainWindow.center(); } catch {}
					}
				} catch {}
				await mainWindow.loadFile(target);
				console.log('[main] loadFile done');
				return { ok: true };
			}
		}
		
		console.warn('[main] open-view: no mainWindow');
		return { ok: false };
	});

	// Cambiar tamaño de ventana actual
	ipcMain.handle('set-window-size', async (_evt, payload: { width?: number; height?: number }) => {
		if (!mainWindow) return { ok: false };
		const w = Number(payload?.width || 0);
		const h = Number(payload?.height || 0);
		if (w > 0 && h > 0) {
			mainWindow.setSize(w, h);
			return { ok: true };
		}
		return { ok: false };
	});

	// IPC Facturación
	ipcMain.handle('facturacion:guardar-config', async (_e, cfg: any) => {
		try { getDb().saveAfipConfig(cfg); return { ok: true }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
	});
	ipcMain.handle('facturacion:emitir', async (_e, payload: any) => {
		try {
			const res = await getFacturacionService().emitirFacturaYGenerarPdf(payload);
			return { ok: true, ...res };
		} catch (e: any) {
			return { ok: false, error: String(e?.message || e) };
		}
	});
	ipcMain.handle('facturacion:listar', async (_e, filtros: { desde?: string; hasta?: string }) => {
		try { const rows = getDb().listFacturas(filtros?.desde, filtros?.hasta); return { ok: true, rows }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
	});
	ipcMain.handle('facturacion:abrir-pdf', async (_e, filePath: string) => {
		try { await getFacturacionService().abrirPdf(filePath); return { ok: true }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
	});
	ipcMain.handle('facturacion:empresa:get', async () => {
		try { return { ok: true, data: getDb().getEmpresaConfig() }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
	});
	ipcMain.handle('facturacion:empresa:save', async (_e, data: any) => {
		try { getDb().saveEmpresaConfig(data); return { ok: true }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
	});
	ipcMain.handle('facturacion:param:get', async () => {
		try { return { ok: true, data: getDb().getParametrosFacturacion() }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
	});
	ipcMain.handle('facturacion:param:save', async (_e, data: any) => {
		try { getDb().saveParametrosFacturacion(data); return { ok: true }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
	});
	ipcMain.handle('facturacion:pdfs', async () => {
		try { return { ok: true, rows: getDb().listPdfsEnDocumentos() }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
	});

	createMainWindow();
	createTray();
	app.on('before-quit', () => { isQuitting = true; });

	// Programación automática
	let autoTimer: NodeJS.Timeout | null = null;
	let autoActive = false;
	let autoPaused = false;
	let remainingSeconds = 0;
	let countdownTimer: NodeJS.Timeout | null = null;
	// Timer autónomo para "remoto"
	let remoteTimer: NodeJS.Timeout | null = null;
	// Timer dedicado para "modo imagen"
	let imageTimer: NodeJS.Timeout | null = null;
	// Watchers en tiempo real (sin intervalo)
	let remoteWatcher: fs.FSWatcher | null = null;
	let imageWatcher: fs.FSWatcher | null = null;

	function isDayEnabled(): boolean {
		const cfg: any = store.get('config') || {};
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
		if (enabledByDay[day] === false) return false;
		
		// Validar rango horario opcional por día: HH:mm → minutos desde 00:00
		function toMinutes(hhmm?: string): number | null {
			if (!hhmm || typeof hhmm !== 'string') return null;
			const m = hhmm.match(/^([0-1]?\d|2[0-3]):([0-5]\d)$/);
			if (!m) return null;
			return parseInt(m[1],10)*60 + parseInt(m[2],10);
		}
		const mapFrom: any = [
			cfg.AUTO_FROM_SUNDAY,
			cfg.AUTO_FROM_MONDAY,
			cfg.AUTO_FROM_TUESDAY,
			cfg.AUTO_FROM_WEDNESDAY,
			cfg.AUTO_FROM_THURSDAY,
			cfg.AUTO_FROM_FRIDAY,
			cfg.AUTO_FROM_SATURDAY
		];
		const mapTo: any = [
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
		if (fromMin === null && toMin === null) return true; // sin restricción horaria
		const nowMin = now.getHours()*60 + now.getMinutes();
		if (fromMin !== null && toMin !== null) {
			if (toMin >= fromMin) {
				return nowMin >= fromMin && nowMin <= toMin;
			} else {
				// Rango nocturno (cruza medianoche): activo si (>= from) o (<= to)
				return nowMin >= fromMin || nowMin <= toMin;
			}
		}
		if (fromMin !== null && toMin === null) return nowMin >= fromMin;
		if (fromMin === null && toMin !== null) return nowMin <= toMin;
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
		try { remoteWatcher?.close(); } catch {}
		remoteWatcher = null;
	}

	function stopImageWatcher() {
		try { imageWatcher?.close(); } catch {}
		imageWatcher = null;
	}

	// Evitar reentradas/concurrencia entre remoto e imagen
	let unifiedScanBusy = false;

	function startCountdown(seconds: number) {
		remainingSeconds = seconds;
		if (countdownTimer) clearInterval(countdownTimer);
		
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

	function delay(ms: number): Promise<void> {
		return new Promise((resolve) => setTimeout(resolve, ms));
	}

	// Timer unificado para "remoto" (prioridad) e "imagen"
	function startRemoteTimer() {
		stopRemoteTimer();
		const cfg: any = store.get('config') || {};
		const globalIntervalSec = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
		const remoteIntervalMs = Number(cfg.AUTO_REMOTE_MS_INTERVAL || 0);
		const useRemoteWatch = cfg.AUTO_REMOTE_WATCH === true;
		const useImageWatch = cfg.IMAGE_WATCH === true;
		const intervalMs = Number.isFinite(remoteIntervalMs) && remoteIntervalMs > 0
			? remoteIntervalMs
			: Math.max(1, globalIntervalSec) * 1000;
		const enabled = cfg.AUTO_REMOTE_ENABLED !== false;
		if (!enabled) return false;
		if (useRemoteWatch && useImageWatch) return false;
		if (!Number.isFinite(intervalMs) || intervalMs <= 0) return false;
		remoteTimer = setInterval(async () => {
			if (!isDayEnabled()) return;
			if (unifiedScanBusy) return;
			unifiedScanBusy = true;
			try {
				// Prioridad 1: remoto solo si no está en modo watch
				const processedRemote = useRemoteWatch ? 0 : await processRemoteOnce();
				// Prioridad 2: imagen solo si no está en modo watch
				if (!useImageWatch && processedRemote === 0) {
					await processImageControlOnce();
				}
				await cleanupImageArtifacts();
			} finally {
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
	function startRemoteWatcher(): boolean {
		stopRemoteWatcher();
		const cfg: any = store.get('config') || {};
		if (cfg.AUTO_REMOTE_WATCH !== true) return false;
		const dir = String(cfg.AUTO_REMOTE_DIR || 'C\\tmp');
		try {
			if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
			remoteWatcher = fs.watch(dir, { persistent: true }, (_event, filename) => {
				try {
					const name = String(filename || '');
					if (!name) return;
					if (!/^mp.*\.txt$/i.test(name)) return;
					if (unifiedScanBusy) return;
					unifiedScanBusy = true;
					setTimeout(async () => {
						try { await processRemoteOnce(); await cleanupImageArtifacts(); }
						finally { unifiedScanBusy = false; }
					}, 150);
				} catch {}
			});
			logInfo('Remote watcher started', { dir });
			return true;
		} catch {
			return false;
		}
	}

	function startImageWatcher(): boolean {
		stopImageWatcher();
		const cfg: any = store.get('config') || {};
		if (cfg.IMAGE_WATCH !== true) return false;
		const dir = String(cfg.IMAGE_CONTROL_DIR || 'C\\tmp');
		const controlFile = String(cfg.IMAGE_CONTROL_FILE || 'direccion.txt');
		try {
			if (!fs.existsSync(dir) || !fs.statSync(dir).isDirectory()) return false;
			imageWatcher = fs.watch(dir, { persistent: true }, (_event, filename) => {
				try {
					const name = String(filename || '');
					if (!name) return;
					if (name.toLowerCase() !== controlFile.toLowerCase()) return;
					if (unifiedScanBusy) return;
					unifiedScanBusy = true;
					setTimeout(async () => {
						try { await processImageControlOnce(); await cleanupImageArtifacts(); }
						finally { unifiedScanBusy = false; }
					}, 150);
				} catch {}
			});
			logInfo('Image watcher started', { dir, controlFile });
			return true;
		} catch {
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
	async function runReportFlowAndNotify(origin: 'manual' | 'auto' | 'remoto' = 'manual') {
		const { payments, range } = await searchPaymentsWithConfig();
		const tag = new Date().toISOString().slice(0, 10);
		let result: any;
		try {
			result = await generateFiles(payments as any[], tag, range);
		} catch (e: any) {
			const code = String(e?.code || '').toUpperCase();
			if (code === 'EPERM' || code === 'EACCES' || code === 'EBUSY' || code === 'EEXIST') {
				try { await delay(750); } catch {}
				result = await generateFiles(payments as any[], tag, range);
			} else {
				throw e;
			}
		}
		logSuccess('Archivos generados exitosamente', { files: (result as any)?.files, count: (payments as any[])?.length, origin });

		// Auto-enviar mp.dbf vía FTP si está configurado
		let ftpAttempted = false;
		let ftpSent = false;
		let ftpSkipped = false;
		let ftpErrorMessage: string | undefined;
		try {
			const mpPath = (result as any)?.files?.mpDbfPath;
			if (mpPath && fs.existsSync(mpPath)) {
				ftpAttempted = true;
				const ftpResult = await sendDbf(mpPath, 'mp.dbf', { force: true });
				if (ftpResult.skipped) {
					ftpSkipped = true;
					if (mainWindow) mainWindow.webContents.send('auto-report-notice', { info: `FTP: sin cambios - no se envía` });
				} else {
					ftpSent = true;
					if (mainWindow) mainWindow.webContents.send('auto-report-notice', { info: `FTP: enviado OK` });
				}
			}
		} catch (e) {
			ftpErrorMessage = String((e as any)?.message || e);
			console.warn('[main] auto FTP send failed:', e);
			if (mainWindow) mainWindow.webContents.send('auto-report-notice', { error: `FTP: ${ftpErrorMessage}` });
		}

		// Reducir payload para UI
		const uiRows = (payments as any[]).slice(0, 1000).map((p: any) => ({
			id: p?.id,
			status: p?.status,
			amount: p?.transaction_amount,
			date: p?.date_created,
			method: p?.payment_method_id
		}));
		if (mainWindow) {
			const rowsShort = uiRows.slice(0, 8);
			mainWindow.webContents.send('auto-report-notice', { [origin]: true, count: (payments as any[]).length, rows: rowsShort });
		}
		return { count: (payments as any[]).length, outDir: (result as any).outDir, files: (result as any).files, rows: uiRows, ftp: { attempted: ftpAttempted, sent: ftpSent, skipped: ftpSkipped, errorMessage: ftpErrorMessage } };
	}

	// Escaneo remoto una vez (autónomo)
	async function processRemoteOnce(): Promise<number> {
		// Disparador remoto: siempre procesar sin respetar días/horas (requisito)
		try {
			const cfgNow: any = store.get('config') || {};
			const enabled = cfgNow.AUTO_REMOTE_ENABLED !== false;
			if (!enabled) return 0;
			const remoteDir = String(cfgNow.AUTO_REMOTE_DIR || 'C:\\tmp');
			let processed = 0;
			if (remoteDir && fs.existsSync(remoteDir)) {
				const entries = fs.readdirSync(remoteDir);
				const toProcess = entries.filter(name => /^mp.*\.txt$/i.test(name));
				// Procesar solo el primero por ciclo para evitar contención de archivos
				const first = toProcess[0];
				if (first) {
					await runReportFlowAndNotify('remoto');
					if (mainWindow) mainWindow.webContents.send('auto-report-notice', { info: `Se procesó archivo remoto: ${first}` });
					try { fs.unlinkSync(path.join(remoteDir, first)); } catch {}
					processed += 1;
				}
			}
			return processed;
		} catch (e) {
			console.warn('[main] remoto: error procesando carpeta remota', e);
			return 0;
		}
	}

	// Procesamiento de archivos de control de imagen
	async function processImageControlOnce(): Promise<number> {
		// Disparador de imagen: siempre procesar sin respetar días/horas (requisito)
		try {
			const cfgNow: any = store.get('config') || {};
			const enabled = cfgNow.IMAGE_ENABLED !== false; // propio enable para imagen
			if (!enabled) return 0;
			
			const controlDir = String(cfgNow.IMAGE_CONTROL_DIR || 'C:\\tmp');
			const controlFile = String(cfgNow.IMAGE_CONTROL_FILE || 'direccion.txt');
			const controlPath = path.join(controlDir, controlFile);
			
			if (!fs.existsSync(controlPath)) {
				return 0; // No hay archivo de control
			}
			
			let content: string = '';
			try {
				content = fs.readFileSync(controlPath, 'utf8');
			} catch (e: any) {
				const code = String(e?.code || '').toUpperCase();
				if (code === 'EBUSY' || code === 'EPERM' || code === 'EACCES') {
					// Otro proceso está escribiendo el archivo. Reintentar en el próximo intervalo.
					logInfo('Imagen: archivo de control ocupado, reintentar', { controlPath, code });
					return 0;
				}
				throw e;
			}
			content = String(content || '').trim();
			if (!content) {
				// Archivo vacío, eliminarlo
				try { fs.unlinkSync(controlPath); } catch {}
				return 0;
			}
			
			// Parseo flexible: URI=... @VENTANA=... @INFO=...
			let filePath = '';
			let windowMode: 'comun' | 'nueva' | 'comun12' | undefined;
			let infoText: string | undefined;
			const parts = content.split('@');
			for (const raw of parts) {
				const seg = raw.trim();
				if (!seg) continue;
				const [kRaw, ...rest] = seg.split('=');
				if (!rest.length) {
					// si no hay '=' y aún no hay filePath, asumir que es una URI directa
					if (!filePath) filePath = seg;
					continue;
				}
				const key = String(kRaw || '').trim().toUpperCase();
				const val = rest.join('=').trim();
				if (key === 'URI') filePath = val;
				else if (key === 'VENTANA') windowMode = String(val).trim().toLowerCase() as any;
				else if (key === 'INFO') infoText = val;
			}
			if (!filePath) {
				// fallback legacy: línea completa era la ruta
				filePath = content;
			}
			// Usar la ruta tal cual llega en el archivo de control (sin normalizar)
			
			// Si es una URL web y piden 'nueva', abrir en el navegador del sistema
			if (windowMode === 'nueva' && isWebUrl(filePath)) {
				try { await shell.openExternal(filePath); } catch {}
				try { fs.unlinkSync(controlPath); } catch {}
				logSuccess('URL abierta en navegador del sistema', { url: filePath });
				return 1;
			}

			// Verificar si el archivo de contenido existe (solo para rutas locales/UNC).
			// Si no existe, intentar variante .mp4 cuando la solicitud era .jpg; si tampoco existe, usar fallback visual por defecto.
			let isFallback = false;
			if (!isWebUrl(filePath) && !fs.existsSync(filePath)) {
				logError('Archivo de contenido no encontrado', { filePath, originalContent: content });
				try {
					// 1) Si el recurso pedido termina en .jpg, probar automáticamente la variante .mp4
					const lower = String(filePath).toLowerCase();
					if (lower.endsWith('.jpg')) {
						const altVideoPath = filePath.slice(0, -4) + '.mp4';
						if (fs.existsSync(altVideoPath)) {
							logInfo('Alternativa encontrada: usando video .mp4 asociado a la imagen faltante', { altVideoPath });
							filePath = altVideoPath; // usar el video y no marcar fallback visual
						} else {
							// 2) No hay .mp4 asociado: aplicar fallback visual por defecto
							const noImage = path.join(app.getAppPath(), 'public', 'Noimage.jpg');
							const logo = path.join(app.getAppPath(), 'public', 'nombre_tc.png');
							const candidate = fs.existsSync(noImage) ? noImage : (fs.existsSync(logo) ? logo : '');
							if (candidate) {
								filePath = candidate;
								isFallback = true;
								infoText = infoText ? `${infoText} • (no encontrado)` : 'Contenido no encontrado';
							} else {
								try { fs.unlinkSync(controlPath); } catch {}
								return 0;
							}
						}
					} else {
						// 3) No era .jpg: aplicar directamente el fallback visual por defecto
						const noImage = path.join(app.getAppPath(), 'public', 'Noimage.jpg');
						const logo = path.join(app.getAppPath(), 'public', 'nombre_tc.png');
						const candidate = fs.existsSync(noImage) ? noImage : (fs.existsSync(logo) ? logo : '');
						if (candidate) {
							filePath = candidate;
							isFallback = true;
							infoText = infoText ? `${infoText} • (no encontrado)` : 'Contenido no encontrado';
						} else {
							try { fs.unlinkSync(controlPath); } catch {}
							return 0;
						}
					}
				} catch {
					try { fs.unlinkSync(controlPath); } catch {}
					return 0;
				}
			}
			
			// Notificar a la UI sobre el nuevo contenido o abrir ventana separada
			const wantNewWindow = (windowMode === 'nueva') || (cfgNow.IMAGE_WINDOW_SEPARATE === true);
			// En modo 'comun12' se envía a ambas: ventana actual (si corresponde) y ventana persistente (reutilizable)
			if (windowMode === 'comun12') {
				if (mainWindow) {
					try { mainWindow.setTitle(infoText || path.basename(filePath)); } catch {}
					mainWindow.webContents.send('image:new-content', { filePath, info: infoText, windowMode: 'comun' });
				}
				// Reutilizar o crear la ventana persistente para presentación
				try {
					if (!imageDualWindow || imageDualWindow.isDestroyed()) {
						imageDualWindow = new BrowserWindow({
							width: 420,
							height: 420,
							title: infoText || path.basename(filePath),
							backgroundColor: '#0f172a',
							webPreferences: { preload: path.join(app.getAppPath(), 'dist', 'src', 'preload.js'), contextIsolation: true, nodeIntegration: false }
						});
						try { imageDualWindow.setMenuBarVisibility(false); } catch {}
						try { imageDualWindow.setAutoHideMenuBar(true); } catch {}
						imageDualWindow.on('closed', () => { imageDualWindow = null; });
						imageDualWindow.on('moved', () => saveImageDualWindowBounds());
						imageDualWindow.on('resize', () => saveImageDualWindowBounds());
						imageDualWindow.on('maximize', () => saveImageDualWindowBounds());
						imageDualWindow.on('unmaximize', () => saveImageDualWindowBounds());
						await imageDualWindow.loadFile(path.join(app.getAppPath(), 'public', 'imagen.html'));
						// Intentar restaurar tamaño/posición previa
						if (!restoreImageDualWindowBounds(imageDualWindow, 420, 420)) {
							// Si no hay bounds guardados, centrar en el mismo monitor que la "comun"
							try {
								const base = mainWindow?.getBounds();
								if (base) {
									const display = screen.getDisplayMatching(base);
									const work = display.workArea || display.bounds;
									const [w, h] = [imageDualWindow.getBounds().width, imageDualWindow.getBounds().height];
									const x = Math.max(work.x, Math.min(base.x + Math.floor((base.width - w) / 2), work.x + work.width - w));
									const y = Math.max(work.y, Math.min(base.y + Math.floor((base.height - h) / 2), work.y + work.height - h));
									imageDualWindow.setBounds({ x, y, width: w, height: h });
								}
							} catch {}
						}
					}
					// Aplicar modo publicidad (pantalla completa) si está activo
					try {
						const active = isPublicidadActive();
						try { imageDualWindow.setFullScreenable(true); } catch {}
						if (active) {
							try { imageDualWindow.setKiosk(true); } catch {}
							try { imageDualWindow.setAlwaysOnTop(true, 'screen-saver'); } catch {}
							try { imageDualWindow.setVisibleOnAllWorkspaces(true, { visibleOnFullScreen: true }); } catch {}
							try { imageDualWindow.setFullScreen(true); } catch {}
						} else {
							try { imageDualWindow.setKiosk(false); } catch {}
							try { imageDualWindow.setAlwaysOnTop(false); } catch {}
							try { imageDualWindow.setVisibleOnAllWorkspaces(false); } catch {}
							try { imageDualWindow.setFullScreen(false); } catch {}
						}
					} catch {}
					try { imageDualWindow?.focus(); } catch {}
					try { imageDualWindow?.setTitle(infoText || path.basename(filePath)); } catch {}
					imageDualWindow?.webContents.send('image:new-content', { filePath, info: infoText, windowMode: 'nueva12', fallback: isFallback, publicidad: isPublicidadActive() });
				} catch {}
			} else if (wantNewWindow) {
				// 'nueva': crear una nueva ventana. Primera vez: centrar; siguientes: restaurar coordenadas guardadas
				try {
					// Política Producto Nuevo: reutilizar la última ventana si llegan muchas solicitudes seguidas
					const pnEnabled = cfgNow.IMAGE_PRODUCTO_NUEVO_ENABLED === true;
					const pnWaitSec = Number(cfgNow.IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS || 0);
					const reuseWindow = pnEnabled && Number.isFinite(pnWaitSec) && pnWaitSec > 0 && (Date.now() - lastImageNewWindowAt) < pnWaitSec * 1000;
					if (reuseWindow && lastImageNewWindow && !lastImageNewWindow.isDestroyed()) {
						try { lastImageNewWindow.focus(); } catch {}
						try { lastImageNewWindow.setTitle(infoText || path.basename(filePath)); } catch {}
						lastImageNewWindow.webContents.send('image:new-content', { filePath, info: infoText, windowMode: 'nueva', fallback: isFallback });
						lastImageNewWindowAt = Date.now();
						logInfo('VENTANA=nueva reutilizada por Producto Nuevo', { withinSeconds: pnWaitSec });
						// Ya refrescamos el contenido en la misma ventana
						try { fs.unlinkSync(controlPath); } catch {}
						return 1;
					}
					const win = new BrowserWindow({
						width: 420,
						height: 420,
						title: infoText || path.basename(filePath),
						backgroundColor: '#0f172a',
						webPreferences: { preload: path.join(app.getAppPath(), 'dist', 'src', 'preload.js'), contextIsolation: true, nodeIntegration: false }
					});
					try { win.setMenuBarVisibility(false); } catch {}
					try { win.setAutoHideMenuBar(true); } catch {}
					// Cerrar con ESC
					try {
						win.webContents.on('before-input-event', (event, input) => {
							if (input.type === 'keyDown' && (input.key === 'Escape' || input.code === 'Escape')) {
								try { event.preventDefault(); } catch {}
								try { win.close(); } catch {}
							}
						});
					} catch {}
					await win.loadFile(path.join(app.getAppPath(), 'public', 'imagen.html'));
					// Restaurar coordenadas guardadas; si no hay, centrar en el mismo monitor que la "comun"
					if (!restoreImageNewWindowBounds(win, 420, 420)) {
						try {
							const base = mainWindow?.getBounds();
							if (base) {
								const display = screen.getDisplayMatching(base);
								const work = display.workArea || display.bounds;
								const [w, h] = [win.getBounds().width, win.getBounds().height];
								const x = Math.max(work.x, Math.min(base.x + Math.floor((base.width - w) / 2), work.x + work.width - w));
								const y = Math.max(work.y, Math.min(base.y + Math.floor((base.height - h) / 2), work.y + work.height - h));
								win.setBounds({ x, y, width: w, height: h });
							}
						} catch {}
					}
					win.on('moved', () => saveImageNewWindowBounds(win));
					win.on('resize', () => saveImageNewWindowBounds(win));
					win.on('closed', () => { if (lastImageNewWindow === win) lastImageNewWindow = null; });
					try { win.focus(); } catch {}
					try { win.setTitle(infoText || path.basename(filePath)); } catch {}
					win.webContents.send('image:new-content', { filePath, info: infoText, windowMode: 'nueva', fallback: isFallback });
					// Registrar como última ventana 'nueva'
					lastImageNewWindow = win;
					lastImageNewWindowAt = Date.now();
				} catch {}
			} else if (mainWindow) {
				try { mainWindow.setTitle(infoText || path.basename(filePath)); } catch {}
				mainWindow.webContents.send('image:new-content', { filePath, info: infoText, windowMode: windowMode || 'comun', fallback: isFallback });
			}
			
			// Eliminar archivo de control después de procesarlo
			try { fs.unlinkSync(controlPath); } catch {}
			
			logSuccess('Contenido de imagen procesado', { filePath, originalContent: content });
			return 1;
		} catch (e) {
			console.warn('[main] imagen: error procesando archivo de control', e);
			return 0;
		}
	}

	// Limpieza básica: eliminar .txt viejos en la carpeta de control
	async function cleanupImageArtifacts() {
		try {
			const cfg: any = store.get('config') || {};
			if (cfg.IMAGE_CLEANUP_ENABLED === false) return false;
			const controlDir = String(cfg.IMAGE_CONTROL_DIR || 'C:\\tmp');
			const maxHours = Number(cfg.IMAGE_CLEANUP_HOURS || 24);
			if (!fs.existsSync(controlDir)) return false;
			const now = Date.now();
			const entries = fs.readdirSync(controlDir).filter((n) => n.toLowerCase().endsWith('.txt'));
			for (const name of entries) {
				try {
					const p = path.join(controlDir, name);
					const st = fs.statSync(p);
					const ageHours = (now - st.mtimeMs) / (1000 * 60 * 60);
					if (ageHours > maxHours) {
						fs.unlinkSync(p);
						logInfo('Imagen cleanup: .txt eliminado por antigüedad', { name, hours: Math.round(ageHours) });
					}
				} catch {}
			}
			return true;
		} catch {
			return false;
		}
	}

	async function startAutoTimer() {
		stopAutoTimer();
		const cfg: any = store.get('config') || {};
		const intervalSec = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
		if (!Number.isFinite(intervalSec) || intervalSec <= 0) return false;

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
			} catch (e: any) {
				// Capturar error específico de MP_ACCESS_TOKEN y mostrar mensaje amigable
				if (e.message && e.message.includes('MP_ACCESS_TOKEN')) {
					const userMessage = '❌ Error: Comprobar la cuenta de Mercado Pago. Ve a Configuración → Mercado Pago y verifica el Access Token.';
					if (mainWindow) {
						mainWindow.webContents.send('auto-report-notice', { error: userMessage });
					}
					logError('Error de configuración Mercado Pago', { message: userMessage });
					recordError('MP_CONFIG', 'Error de configuración Mercado Pago', { message: userMessage });
				} else {
					// Para otros errores, mantener el comportamiento original
					if (mainWindow) mainWindow.webContents.send('auto-report-notice', { error: String(e?.message || e) });
				}
			}
		}, Math.max(1000, intervalSec * 1000));

		// Iniciar countdown
		startCountdown(intervalSec);
		autoActive = true;
		autoPaused = false;
		return true;
	}

	ipcMain.handle('auto-start', async () => {
		const okAuto = await startAutoTimer();
		// Si no hay intervalo global, intentar al menos encender timers remoto/imagen
		const okRemote = startRemoteTimer() === true;
		const okImage = startImageTimer() === true;
		return { ok: okAuto || okRemote || okImage };
	});

	ipcMain.handle('auto-stop', async () => {
		stopAutoTimer();
		autoActive = false;
		autoPaused = false;
		remainingSeconds = 0;
		return { ok: true };
	});

	ipcMain.handle('auto-status', async () => {
		return { active: autoActive, paused: autoPaused };
	});

	// Nuevos handlers para pausar/reanudar
	ipcMain.handle('auto-pause', async () => {
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

	ipcMain.handle('auto-resume', async () => {
		const cfg: any = store.get('config') || {};
		const intervalSec = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
		if (!Number.isFinite(intervalSec) || intervalSec <= 0) return { ok: false, error: 'No hay intervalo configurado' };

		// Si no hay tiempo restante, usar el intervalo completo
		if (remainingSeconds <= 0) {
			remainingSeconds = intervalSec;
		}

		await startAutoTimer();
		store.set('autoPaused', false);
		return { ok: true, remaining: remainingSeconds };
	});

	ipcMain.handle('auto-get-timer', async () => {
		const cfg: any = store.get('config') || {};
		const configuredSeconds = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
		return { 
			configured: configuredSeconds,
			remaining: remainingSeconds,
			active: autoActive,
			paused: autoPaused
		};
	});

	// Opcional: arrancar timers si hay configuración previa
	const cfg0: any = store.get('config') || {};
	if (Number(cfg0.AUTO_INTERVAL_SECONDS || 0) > 0) {
		// Restaurar estado de pausa si existía
		const wasPaused = store.get('autoPaused') as boolean;
		if (wasPaused) {
			autoPaused = true;
			remainingSeconds = Number(store.get('remainingSeconds') || 0);
		} else {
			startAutoTimer().catch(()=>{});
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
	ipcMain.handle('auth:is-initialized', () => {
		return AuthService.isInitialized();
	});

	// Obtener política de contraseñas
	ipcMain.handle('auth:get-policy', () => {
		return AuthService.policy();
	});

	// Configurar administrador inicial
	ipcMain.handle('auth:setup', async (_e, { username, password, secretPhrase }) => {
		try {
			await AuthService.setup(username, password, secretPhrase);
			return { ok: true };
		} catch (error: any) {
			logAuth('Error en configuración inicial', { error: error.message });
			throw error;
		}
	});

	// Login
	ipcMain.handle('auth:login', async (_e, { username, password }) => {
		try {
			const result = await AuthService.login(username, password);
			return result;
		} catch (error: any) {
			logAuth('Error en inicio de sesión', { error: error.message });
			return { ok: false, reason: 'error' };
		}
	});

	// Cambiar contraseña
	ipcMain.handle('auth:change', async (_e, { current, newPw, newUser, newSecret }) => {
		try {
			await AuthService.changePassword(current, newPw, newUser, newSecret);
			return { ok: true };
		} catch (error: any) {
			logAuth('Error en cambio de contraseña', { error: error.message });
			throw error;
		}
	});

	// Reset por frase secreta
	ipcMain.handle('auth:reset-by-secret', async (_e, { secretPhrase, newPw, newUser }) => {
		try {
			await AuthService.resetBySecret(secretPhrase, newPw, newUser);
			return { ok: true };
		} catch (error: any) {
			logAuth('Error en reset por frase secreta', { error: error.message });
			throw error;
		}
	});

	// Solicitar OTP
	ipcMain.handle('auth:request-otp', async () => {
		try {
			const cfg: any = store.get('config') || {};
			const email = cfg.EMAIL_REPORT;
			if (!email) throw new Error('no_email');
			
			return OtpService.createAndSend(email);
		} catch (error: any) {
			logAuth('Error en solicitud de OTP', { error: error.message });
			throw error;
		}
	});

	// Reset por OTP
	ipcMain.handle('auth:reset-by-otp', async (_e, { otp, newPw, newUser }) => {
		try {
			if (!OtpService.validate(otp)) throw new Error('invalid_otp');
			await AuthService.resetByOtp(newPw, newUser);
			return { ok: true };
		} catch (error: any) {
			logAuth('Error en reset por OTP', { error: error.message });
			throw error;
		}
	});

	// Abrir config.html después del login exitoso
	ipcMain.handle('auth:open-config', async () => {
		if (mainWindow) {
			const target = path.join(app.getAppPath(), 'public', 'config.html');
			console.log('[main] auth successful → loading config.html');
			// Ajustar tamaño para config
			try {
				mainWindow.setMinimumSize(900, 600);
				mainWindow.setSize(1200, 768);
				mainWindow.setMenuBarVisibility(false);
				mainWindow.setAutoHideMenuBar(true);
				try { mainWindow.center(); } catch {}
			} catch {}
			await mainWindow.loadFile(target);
			console.log('[main] config.html loaded');
			return { ok: true };
		}
		return { ok: false };
	});

	// ===== HANDLERS DE NOTIFICACIONES DE ERROR =====
	
	// Obtener configuración de notificaciones de error
	ipcMain.handle('error-notifications:get-config', () => {
		return getErrorNotificationConfig();
	});

	// ===== HANDLERS DE PERFILES =====
	ipcMain.handle('perfiles:list', async () => {
		try { const rows = getDb().listPerfiles(); return { ok: true, rows }; } catch (e:any) { return { ok: false, error: String(e?.message||e) }; }
	});
	ipcMain.handle('perfiles:get', async (_e, id: number) => {
		try { const row = getDb().getPerfil(Number(id)); return { ok: true, row }; } catch (e:any) { return { ok: false, error: String(e?.message||e) }; }
	});
	ipcMain.handle('perfiles:save', async (_e, perfil: any) => {
		try { const id = getDb().savePerfil(perfil); return { ok: true, id }; } catch (e:any) { return { ok: false, error: String(e?.message||e) }; }
	});
	ipcMain.handle('perfiles:delete', async (_e, id: number) => {
		try { const ok = getDb().deletePerfil(Number(id)); return { ok }; } catch (e:any) { return { ok: false, error: String(e?.message||e) }; }
	});

	// Actualizar configuración de notificaciones de error
	ipcMain.handle('error-notifications:update-config', async (_e, config) => {
		try {
			updateErrorNotificationConfig(config);
			return { ok: true };
		} catch (error: any) {
			logError('Error al actualizar configuración de notificaciones', { error: error.message });
			return { ok: false, error: error.message };
		}
	});

	// Obtener resumen de errores
	ipcMain.handle('error-notifications:get-summary', () => {
		return getErrorSummary();
	});

	// Limpiar errores antiguos
	ipcMain.handle('error-notifications:clear-old', async (_e, hours = 24) => {
		try {
			clearOldErrors(hours);
			return { ok: true };
		} catch (error: any) {
			logError('Error al limpiar errores antiguos', { error: error.message });
			return { ok: false, error: error.message };
		}
	});

	// Resetear todas las notificaciones
	ipcMain.handle('error-notifications:reset', async () => {
		try {
			resetErrorNotifications();
			return { ok: true };
		} catch (error: any) {
			logError('Error al resetear notificaciones', { error: error.message });
			return { ok: false, error: error.message };
		}
	});

	// ===== HANDLERS DE MODO IMAGEN =====

	// Probar lectura del archivo de control
	ipcMain.handle('image:test-control', async () => {
		try {
			const cfg: any = store.get('config') || {};
			const controlDir = String(cfg.IMAGE_CONTROL_DIR || 'C:\\tmp');
			const controlFile = String(cfg.IMAGE_CONTROL_FILE || 'direccion.txt');
			const controlPath = path.join(controlDir, controlFile);
			
			if (!fs.existsSync(controlPath)) {
				return { success: false, error: 'Archivo de control no encontrado' };
			}
			
			const content = fs.readFileSync(controlPath, 'utf8').trim();
			if (!content) {
				return { success: false, error: 'Archivo de control vacío' };
			}
			
			// Extraer la ruta del contenido (soporta formato "URI=ruta" o solo "ruta")
			let filePath = content;
			if (content.startsWith('URI=')) {
				filePath = content.substring(4).trim();
			}
			
			// Verificar si el archivo existe
			if (!fs.existsSync(filePath)) {
				return { success: false, error: 'Archivo de contenido no encontrado' };
			}
			
			return { success: true, filePath };
		} catch (error: any) {
			logError('Error al probar archivo de control de imagen', { error: error.message });
			return { success: false, error: error.message };
		}
	});

	// Abrir archivo con la app del sistema (visor)
	ipcMain.handle('image:open-external', async (_e, fullPath: string) => {
		try {
			await shell.openPath(fullPath);
			return true;
		} catch {
			return false;
		}
	});

	// ===== HANDLERS DE LICENCIA =====

	ipcMain.handle('license:status', async () => {
		return { ok: licenciaExisteYValida() };
	});

	// ===== HANDLERS FTP SERVER =====
	ipcMain.handle('ftp-server:start', async (_e, cfg: any) => {
		try { const ok = await startFtpServer(cfg || {}); return { ok }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
	});
	ipcMain.handle('ftp-server:stop', async () => {
		try { const ok = await stopFtpServer(); return { ok }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
	});
	ipcMain.handle('ftp-server:status', async () => {
		return { running: isFtpServerRunning() };
	});

	// ===== HANDLERS DE CONTROL REMOTO =====
	ipcMain.handle('remote:saveConfig', async (_e, config: any) => {
		try {
			const { getRemoteService } = await import('./services/RemoteService');
			const success = await getRemoteService().saveConfig(config);
			return { ok: success };
		} catch (e: any) {
			logError('Error guardando configuración remota', { error: e?.message || e });
			return { ok: false, error: String(e?.message || e) };
		}
	});

	ipcMain.handle('remote:getConfig', async () => {
		try {
			const { getRemoteService } = await import('./services/RemoteService');
			const config = await getRemoteService().getConfig();
			
			// Asegurar que el objeto sea completamente serializable
			if (config) {
				// Crear un objeto plano con solo las propiedades necesarias
				const serializedConfig = {
					idServer: config.idServer || '',
					relayServer: config.relayServer || '',
					username: config.username || '',
					password: config.password || '',
					role: config.role || 'host',
					autoStart: config.autoStart || false
				};
				return { ok: true, data: serializedConfig };
			}
			return { ok: true, data: null };
		} catch (e: any) {
			logError('Error obteniendo configuración remota', { error: e?.message || e });
			return { ok: false, error: String(e?.message || e) };
		}
	});

	ipcMain.handle('remote:startHost', async () => {
		try {
			const { getRemoteService } = await import('./services/RemoteService');
			const success = await getRemoteService().startHost();
			return { ok: success };
		} catch (e: any) {
			logError('Error iniciando Host remoto', { error: e?.message || e });
			return { ok: false, error: String(e?.message || e) };
		}
	});

	ipcMain.handle('remote:startViewer', async (_e, hostId: string) => {
		try {
			const { getRemoteService } = await import('./services/RemoteService');
			const success = await getRemoteService().startViewer(hostId);
			return { ok: success };
		} catch (e: any) {
			logError('Error iniciando Viewer remoto', { error: e?.message || e });
			return { ok: false, error: String(e?.message || e) };
		}
	});

	ipcMain.handle('remote:getOnlineHosts', async () => {
		try {
			const { getRemoteService } = await import('./services/RemoteService');
			const hosts = await getRemoteService().getOnlineHosts();
			return { ok: true, hosts };
		} catch (e: any) {
			logError('Error obteniendo hosts online', { error: e?.message || e });
			return { ok: false, error: String(e?.message || e) };
		}
	});

	ipcMain.handle('remote:stopHost', async () => {
		try {
			const { getRemoteService } = await import('./services/RemoteService');
			await getRemoteService().stopHost();
			return { ok: true };
		} catch (e: any) {
			logError('Error deteniendo Host remoto', { error: e?.message || e });
			return { ok: false, error: String(e?.message || e) };
		}
	});

	ipcMain.handle('remote:stopViewer', async () => {
		try {
			const { getRemoteService } = await import('./services/RemoteService');
			await getRemoteService().stopViewer();
			return { ok: true };
		} catch (e: any) {
			logError('Error deteniendo Viewer remoto', { error: e?.message || e });
			return { ok: false, error: String(e?.message || e) };
		}
	});

	ipcMain.handle('remote:stopAll', async () => {
		try {
			const { getRemoteService } = await import('./services/RemoteService');
			await getRemoteService().stopAll();
			return { ok: true };
		} catch (e: any) {
			logError('Error deteniendo todos los procesos remotos', { error: e?.message || e });
			return { ok: false, error: String(e?.message || e) };
		}
	});

	ipcMain.handle('remote:pingServer', async () => {
		try {
			const { getRemoteService } = await import('./services/RemoteService');
			const isOnline = await getRemoteService().pingServer();
			return { ok: true, online: isOnline };
		} catch (e: any) {
			logError('Error haciendo ping al servidor remoto', { error: e?.message || e });
			return { ok: false, error: String(e?.message || e) };
		}
	});

	ipcMain.handle('remote:getStatus', async () => {
		try {
			const { getRemoteService } = await import('./services/RemoteService');
			const service = getRemoteService();
			const status = await service.getStatus();
			
			// Asegurar que el objeto sea completamente serializable
			const serializedStatus = {
				config: status.config ? {
					idServer: status.config.idServer || '',
					relayServer: status.config.relayServer || '',
					username: status.config.username || '',
					password: status.config.password || '',
					role: status.config.role || 'host',
					autoStart: status.config.autoStart || false
				} : null,
				serverOnline: Boolean(status.serverOnline),
				hostsCount: Number(status.hostsCount) || 0,
				hostRunning: Boolean(status.hostRunning),
				viewerRunning: Boolean(status.viewerRunning),
				activeProcesses: Array.isArray(status.activeProcesses) ? status.activeProcesses : [],
				hostId: status.hostId || null
			};
			
			return {
				ok: true,
				...serializedStatus
			};
		} catch (e: any) {
			logError('Error obteniendo estado remoto', { error: e?.message || e });
			return { ok: false, error: String(e?.message || e) };
		}
	});

	ipcMain.handle('license:validate', async (_e, { nombreCliente, palabraSecreta, serial }: { nombreCliente: string; palabraSecreta: string; serial: string }) => {
		return { ok: validarSerial(nombreCliente || '', palabraSecreta || '', serial || '') };
	});

	ipcMain.handle('license:save', async (_e, { nombreCliente, serial, palabraSecreta }: { nombreCliente: string; serial: string; palabraSecreta: string }) => {
		return guardarLicencia(nombreCliente, serial, palabraSecreta);
	});

	ipcMain.handle('license:load', async () => {
		return cargarLicencia();
	});

	ipcMain.handle('license:recover', async (_e, { nombreCliente, palabraSecreta }: { nombreCliente: string; palabraSecreta: string }) => {
		return recuperarSerial(nombreCliente, palabraSecreta);
	});

	ipcMain.handle('license:open-home', async () => {
		if (!mainWindow) return { ok: false };
		try {
			const cfg: any = store.get('config') || {};
			let defaultView: 'config' | 'caja' = (cfg?.DEFAULT_VIEW as any) === 'config' ? 'config' : 'caja';
			const file = (defaultView ?? 'caja') === 'caja' ? 'caja.html' : 'config.html';
			const target = path.join(app.getAppPath(), 'public', file);
			if (defaultView === 'caja') {
				try {
					mainWindow.setMinimumSize(420, 320);
					mainWindow.setSize(420, 320);
					mainWindow.setMenuBarVisibility(false);
					mainWindow.setAutoHideMenuBar(true);
					try { mainWindow.center(); } catch {}
				} catch {}
			} else {
				try {
					mainWindow.setMinimumSize(900, 600);
					mainWindow.setSize(1200, 768);
					mainWindow.setMenuBarVisibility(false);
					mainWindow.setAutoHideMenuBar(true);
					try { mainWindow.center(); } catch {}
				} catch {}
			}
			await mainWindow.loadFile(target);
			return { ok: true };
		} catch (e: any) {
			return { ok: false, error: String(e?.message || e) };
		}
	});

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
