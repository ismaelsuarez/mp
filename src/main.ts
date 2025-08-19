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
import { generateFiles, getOutDir } from './services/ReportService';
import { testFtp, sendTodayDbf, sendDbf } from './services/FtpService';
import { sendReportEmail } from './services/EmailService';
import { logInfo, logSuccess, logError, logWarning, logMp, logFtp, logAuth, getTodayLogPath, ensureLogsDir, ensureTodayLogExists } from './services/LogService';
import { recordError, getErrorNotificationConfig, updateErrorNotificationConfig, getErrorSummary, clearOldErrors, resetErrorNotifications } from './services/ErrorNotificationService';
import { AuthService } from './services/AuthService';
import { OtpService } from './services/OtpService';
import { licenciaExisteYValida, validarSerial, guardarLicencia, cargarLicencia, recuperarSerial } from './utils/licencia';

let mainWindow: BrowserWindow | null = null;
let tray: Tray | null = null;
let isQuitting = false;

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
		const target = path.join(app.getAppPath(), 'public', 'caja.html');
		try {
			mainWindow.setMinimumSize(420, 320);
			mainWindow.setSize(420, 320);
			mainWindow.setMenuBarVisibility(false);
			mainWindow.setAutoHideMenuBar(true);
			// Restaurar posición previa; si no existe, centrar
			if (!restoreCajaWindowPosition(420, 320)) {
				try { mainWindow.center(); } catch {}
			}
		} catch {}
		await mainWindow.loadFile(target);
	} else if (view === 'imagen') {
		// imagen
		const target = path.join(app.getAppPath(), 'public', 'imagen.html');
		try {
			mainWindow.setMinimumSize(800, 600);
			mainWindow.setSize(800, 600);
			mainWindow.setMenuBarVisibility(false);
			mainWindow.setAutoHideMenuBar(true);
			try { mainWindow.center(); } catch {}
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

function createTray() {
	if (tray) return;
	tray = new Tray(getTrayImage());
	try { tray.setToolTip('MP'); } catch {}
	tray.on('click', () => {
		if (!mainWindow) return;
		if (mainWindow.isVisible()) hideToTray();
		else showMainWindow();
	});
	const contextMenu = Menu.buildFromTemplate([
		{ label: 'Mostrar', click: () => showMainWindow() },
		{ type: 'separator' },
		{ label: 'Ir a Caja', click: () => openViewFromTray('caja') },
		{ label: 'Ir a Imagen', click: () => openViewFromTray('imagen') },
		{ label: 'Ir a Configuración', click: () => openViewFromTray('config') },
		{ type: 'separator' },
		{ label: 'Salir', click: () => { isQuitting = true; app.quit(); } }
	]);
	try { tray.setContextMenu(contextMenu); } catch {}
}

function saveCajaWindowPosition() {
	try {
		if (!mainWindow) return;
		const bounds = mainWindow.getBounds();
		const display = screen.getDisplayMatching(bounds);
		const work = display.workArea || display.bounds;
		store.set('cajaWindowPosition', {
			x: bounds.x,
			y: bounds.y,
			workW: work.width,
			workH: work.height
		});
	} catch {}
}

function restoreCajaWindowPosition(minWidth = 420, minHeight = 320) {
	try {
		const saved = store.get('cajaWindowPosition') as { x: number; y: number; workW?: number; workH?: number } | undefined;
		if (!saved || saved.x === undefined || saved.y === undefined) return false;
		const primary = screen.getPrimaryDisplay();
		const { width, height } = primary.workAreaSize;
		const scaleX = saved.workW && saved.workW > 0 ? width / saved.workW : 1;
		const scaleY = saved.workH && saved.workH > 0 ? height / saved.workH : 1;
		let x = Math.round(saved.x * scaleX);
		let y = Math.round(saved.y * scaleY);
		x = Math.max(0, Math.min(x, Math.max(0, width - minWidth)));
		y = Math.max(0, Math.min(y, Math.max(0, height - minHeight)));
		if (mainWindow) mainWindow.setPosition(x, y);
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
	let defaultView: 'config' | 'caja' = (cfg?.DEFAULT_VIEW as any) === 'config' ? 'config' : 'caja';
	const initialFile = (defaultView ?? 'caja') === 'caja' ? 'caja.html' : 'config.html';

	// Bypass de licencia en desarrollo si SKIP_LICENSE=true o flag --skip-license
	const devBypass = (!app.isPackaged) && (String(process.env.SKIP_LICENSE).toLowerCase() === 'true' || process.argv.includes('--skip-license'));

	// Ajustar visibilidad de menú y tamaño acorde a la vista inicial
	try {
		if (defaultView === 'caja') {
			// Tamaño compacto como la captura
			mainWindow.setMinimumSize(420, 320);
			mainWindow.setSize(420, 320);
			mainWindow.setMenuBarVisibility(false);
			mainWindow.setAutoHideMenuBar(true);
			
			// Restaurar posición guardada para modo caja (escalando por resolución)
			if (!restoreCajaWindowPosition(420, 320)) {
				// Si no hay posición guardada, centrar
				try { mainWindow.center(); } catch {}
			}
		} else {
			// Modo Configuración: tamaño amplio como en la captura
			mainWindow.setMinimumSize(900, 600);
			mainWindow.setSize(1200, 768);
			// Ocultar menú también en Configuración
			mainWindow.setMenuBarVisibility(false);
			mainWindow.setAutoHideMenuBar(true);
			// Centrar la ventana cuando se abre Configuración
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
		const cfg: any = store.get('config') || {};
		const currentView = (cfg?.DEFAULT_VIEW as any) === 'config' ? 'config' : 'caja';
		
		// Solo guardar posición si estamos en modo caja
		if (currentView === 'caja') {
			saveCajaWindowPosition();
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

app.whenReady().then(() => {
    ensureLogsDir();
    ensureTodayLogExists();

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
			// Reiniciar timer remoto para aplicar cambios (intervalo/directorio)
			restartRemoteTimerIfNeeded();
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
				const target = path.join(app.getAppPath(), 'public', file);
				console.log('[main] loading file:', target);
				// Ajustar tamaño según vista
				try {
					mainWindow.setMinimumSize(420, 320);
					mainWindow.setSize(420, 320);
					mainWindow.setMenuBarVisibility(false);
					mainWindow.setAutoHideMenuBar(true);
					
					// Restaurar posición guardada para modo caja
					const savedPosition = store.get('cajaWindowPosition') as { x: number; y: number } | undefined;
					if (savedPosition && savedPosition.x !== undefined && savedPosition.y !== undefined) {
						// Verificar que la posición esté dentro de los límites de la pantalla
						const { screen } = require('electron');
						const primaryDisplay = screen.getPrimaryDisplay();
						const { width, height } = primaryDisplay.workAreaSize;
						
						// Asegurar que la ventana esté visible en la pantalla
						const x = Math.max(0, Math.min(savedPosition.x, width - 420));
						const y = Math.max(0, Math.min(savedPosition.y, height - 320));
						
						mainWindow.setPosition(x, y);
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
				const target = path.join(app.getAppPath(), 'public', file);
				console.log('[main] loading file:', target);
				// Ajustar tamaño para modo imagen
				try {
					mainWindow.setMinimumSize(800, 600);
					mainWindow.setSize(800, 600);
					mainWindow.setMenuBarVisibility(false);
					mainWindow.setAutoHideMenuBar(true);
					try { mainWindow.center(); } catch {}
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

	// Timer autónomo para modo "remoto" y modo imagen
	function startRemoteTimer() {
		stopRemoteTimer();
		const cfg: any = store.get('config') || {};
		const globalIntervalSec = Number(cfg.AUTO_INTERVAL_SECONDS || 0);
		const imageIntervalSec = Number(cfg.IMAGE_INTERVAL_SECONDS || 0);
		const remoteIntervalMs = Number(cfg.AUTO_REMOTE_MS_INTERVAL || 0);
		const intervalMs = Number.isFinite(remoteIntervalMs) && remoteIntervalMs > 0
			? remoteIntervalMs
			: (Math.max(1, (Number.isFinite(imageIntervalSec) && imageIntervalSec > 0 ? imageIntervalSec : globalIntervalSec)) * 1000);
		const enabled = cfg.AUTO_REMOTE_ENABLED !== false;
		if (!enabled) return false;
		if (!Number.isFinite(intervalMs) || intervalMs <= 0) return false;
		remoteTimer = setInterval(async () => {
			if (!isDayEnabled()) return;
			await processRemoteOnce();
			await processImageControlOnce(); // Procesar también archivos de control de imagen
		}, Math.max(10, intervalMs));
		return true;
	}

	function restartRemoteTimerIfNeeded() {
		stopRemoteTimer();
		startRemoteTimer();
	}

	// Función reutilizable: ejecutar flujo de reporte y notificar a la UI
	async function runReportFlowAndNotify(origin: 'manual' | 'auto' | 'remoto' = 'manual') {
		const { payments, range } = await searchPaymentsWithConfig();
		const tag = new Date().toISOString().slice(0, 10);
		const result = await generateFiles(payments as any[], tag, range);
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
				const ftpResult = await sendDbf(mpPath, 'mp.dbf');
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
		if (!isDayEnabled()) return 0;
		try {
			const cfgNow: any = store.get('config') || {};
			const enabled = cfgNow.AUTO_REMOTE_ENABLED !== false;
			if (!enabled) return 0;
			const remoteDir = String(cfgNow.AUTO_REMOTE_DIR || 'C:\\tmp');
			let processed = 0;
			if (remoteDir && fs.existsSync(remoteDir)) {
				const entries = fs.readdirSync(remoteDir);
				const toProcess = entries.filter(name => /^mp.*\.txt$/i.test(name));
				for (const name of toProcess) {
					await runReportFlowAndNotify('remoto');
					if (mainWindow) mainWindow.webContents.send('auto-report-notice', { info: `Se procesó archivo remoto: ${name}` });
					try { fs.unlinkSync(path.join(remoteDir, name)); } catch {}
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
		if (!isDayEnabled()) return 0;
		try {
			const cfgNow: any = store.get('config') || {};
			const enabled = cfgNow.AUTO_REMOTE_ENABLED !== false;
			if (!enabled) return 0;
			
			const controlDir = String(cfgNow.IMAGE_CONTROL_DIR || 'C:\\tmp');
			const controlFile = String(cfgNow.IMAGE_CONTROL_FILE || 'direccion.txt');
			const controlPath = path.join(controlDir, controlFile);
			
			if (!fs.existsSync(controlPath)) {
				return 0; // No hay archivo de control
			}
			
			const content = fs.readFileSync(controlPath, 'utf8').trim();
			if (!content) {
				// Archivo vacío, eliminarlo
				try { fs.unlinkSync(controlPath); } catch {}
				return 0;
			}
			
			// Extraer la ruta del contenido (soporta formato "URI=ruta" o solo "ruta")
			let filePath = content;
			if (content.startsWith('URI=')) {
				filePath = content.substring(4).trim();
			}
			
			// Verificar si el archivo de contenido existe
			if (!fs.existsSync(filePath)) {
				logError('Archivo de contenido no encontrado', { filePath, originalContent: content });
				// Eliminar archivo de control aunque el contenido no exista
				try { fs.unlinkSync(controlPath); } catch {}
				return 0;
			}
			
			// Notificar a la UI sobre el nuevo contenido o abrir ventana separada
			const openSeparate = cfgNow.IMAGE_WINDOW_SEPARATE === true;
			if (openSeparate) {
				try {
					const win = new BrowserWindow({
						width: 1100,
						height: 760,
						title: 'Modo Imagen – Visor',
						backgroundColor: '#0f172a',
						webPreferences: { preload: path.join(app.getAppPath(), 'dist', 'src', 'preload.js'), contextIsolation: true, nodeIntegration: false }
					});
					await win.loadFile(path.join(app.getAppPath(), 'public', 'imagen.html'));
					try { win.focus(); } catch {}
					// Enviar evento al render para mostrar contenido
					win.webContents.send('image:new-content', { filePath });
				} catch {}
			} else if (mainWindow) {
				mainWindow.webContents.send('image:new-content', { filePath });
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
		const ok = await startAutoTimer();
		return { ok };
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

	// Opcional: arrancar si estaba configurado
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
		// Iniciar también el timer autónomo de remoto
		startRemoteTimer();
	}

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
