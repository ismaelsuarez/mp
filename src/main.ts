import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Store from 'electron-store';
import cron from 'node-cron';
import { searchPaymentsWithConfig, testConnection } from './services/MercadoPagoService';
import { generateFiles, getOutDir } from './services/ReportService';
import { testFtp, sendTodayDbf, sendDbf } from './services/FtpService';
import { sendReportEmail } from './services/EmailService';
import { logInfo, logSuccess, logError, logWarning, logMp, logFtp, logAuth, getTodayLogPath, ensureLogsDir, ensureTodayLogExists } from './services/LogService';
import { recordError, getErrorNotificationConfig, updateErrorNotificationConfig, getErrorSummary, clearOldErrors, resetErrorNotifications } from './services/ErrorNotificationService';
import { AuthService } from './services/AuthService';
import { OtpService } from './services/OtpService';
import { licenciaExisteYValida, generarSerial, validarSerial, guardarLicencia, cargarLicencia, recuperarSerial } from './utils/licencia';

let mainWindow: BrowserWindow | null = null;

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

const store = new Store<{ config?: Record<string, unknown> }>({ name: 'settings', encryptionKey: getEncryptionKey() });

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

	// Ajustar visibilidad de menú y tamaño acorde a la vista inicial
	try {
		if (defaultView === 'caja') {
			// Tamaño compacto como la captura
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

	// Gate de licencia: si no existe/vale, mostrar licencia.html
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
		} else {
			const htmlPath = path.join(app.getAppPath(), 'public', initialFile);
			mainWindow.loadFile(htmlPath);
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
	}

	// Guardar posición de la ventana cuando se mueve (solo para modo caja)
	mainWindow.on('moved', () => {
		const cfg: any = store.get('config') || {};
		const currentView = (cfg?.DEFAULT_VIEW as any) === 'config' ? 'config' : 'caja';
		
		// Solo guardar posición si estamos en modo caja
		if (currentView === 'caja') {
			const [x, y] = mainWindow.getPosition();
			store.set('cajaWindowPosition', { x, y });
		}
	});

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

// Desactivar aceleración por GPU (mejora compatibilidad en WSL/VMs)
app.disableHardwareAcceleration();

app.whenReady().then(() => {
    ensureLogsDir();
    ensureTodayLogExists();
	// IPC seguro para configuración
	ipcMain.handle('get-config', () => {
		return store.get('config') || {};
	});
	ipcMain.handle('save-config', (_event, cfg: Record<string, unknown>) => {
		if (cfg && typeof cfg === 'object') {
			store.set('config', cfg);
			return true;
		}
		return false;
	});

	ipcMain.handle('test-connection', async () => {
		return await testConnection();
	});

	// Generar reporte bajo demanda
	ipcMain.handle('generate-report', async () => {
		logInfo('Reporte manual solicitado');
		try {
			const { payments, range } = await searchPaymentsWithConfig();
			const tag = new Date().toISOString().slice(0, 10);
			const result = await generateFiles(payments as any[], tag, range);
			logSuccess('Archivos generados exitosamente', { files: (result as any)?.files, count: (payments as any[])?.length });
			// Auto-enviar mp.dbf vía FTP si está configurado
			try {
				const mpPath = (result as any)?.files?.mpDbfPath;
				if (mpPath && fs.existsSync(mpPath)) {
					const ftpResult = await sendDbf(mpPath, 'mp.dbf');
					if (ftpResult.skipped) {
						if (mainWindow) mainWindow.webContents.send('auto-report-notice', { info: `FTP: sin cambios - no se envía` });
					} else {
						if (mainWindow) mainWindow.webContents.send('auto-report-notice', { info: `FTP: enviado OK` });
					}
				}
			} catch (e) {
				console.warn('[main] auto FTP send failed:', e);
				if (mainWindow) mainWindow.webContents.send('auto-report-notice', { error: `FTP: ${String((e as any)?.message || e)}` });
			}
			// Reducir payload para UI y notificar a Caja
			const uiRows = (payments as any[]).slice(0, 1000).map((p: any) => ({
				id: p?.id,
				status: p?.status,
				amount: p?.transaction_amount,
				date: p?.date_created,
				method: p?.payment_method_id
			}));
			if (mainWindow) {
				const rowsShort = uiRows.slice(0, 8);
				mainWindow.webContents.send('auto-report-notice', { manual: true, count: (payments as any[]).length, rows: rowsShort });
			}
			return { count: (payments as any[]).length, outDir: result.outDir, files: result.files, rows: uiRows };
		} catch (error: any) {
			// Capturar error específico de MP_ACCESS_TOKEN y mostrar mensaje amigable
			if (error.message && error.message.includes('MP_ACCESS_TOKEN')) {
				const userMessage = '❌ Error: Comprobar la cuenta de Mercado Pago. Ve a Configuración → Mercado Pago y verifica el Access Token.';
				if (mainWindow) {
					mainWindow.webContents.send('auto-report-notice', { error: userMessage });
				}
				logError('Error de configuración Mercado Pago', { message: userMessage });
				recordError('MP_CONFIG', 'Error de configuración Mercado Pago', { message: userMessage });
				throw new Error(userMessage);
			} else {
				// Para otros errores, mantener el comportamiento original
				if (mainWindow) {
					mainWindow.webContents.send('auto-report-notice', { error: String(error?.message || error) });
				}
				throw error;
			}
		}
	});

	// Export on-demand without re-fetch (assumes files already generated or uses latest payments)
	ipcMain.handle('export-report', async () => {
		const outDir = getOutDir();
		return { outDir };
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

	// Abrir vistas (config/caja)
	ipcMain.handle('open-view', async (_evt, view: 'config' | 'caja') => {
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
		} else {
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

	// Programación automática
	let autoTimer: NodeJS.Timeout | null = null;
	let autoActive = false;
	let autoPaused = false;
	let remainingSeconds = 0;
	let countdownTimer: NodeJS.Timeout | null = null;

	function isDayEnabled(): boolean {
		const cfg: any = store.get('config') || {};
		const today = new Date().getDay(); // 0 = Domingo, 1 = Lunes, ..., 6 = Sábado
		
		// Mapear el día actual a la configuración
		const dayConfigs = [
			cfg.AUTO_DAYS_SUNDAY,    // 0 = Domingo
			cfg.AUTO_DAYS_MONDAY,    // 1 = Lunes
			cfg.AUTO_DAYS_TUESDAY,   // 2 = Martes
			cfg.AUTO_DAYS_WEDNESDAY, // 3 = Miércoles
			cfg.AUTO_DAYS_THURSDAY,  // 4 = Jueves
			cfg.AUTO_DAYS_FRIDAY,    // 5 = Viernes
			cfg.AUTO_DAYS_SATURDAY   // 6 = Sábado
		];
		
		// Si no hay configuración específica, por defecto está habilitado
		return dayConfigs[today] !== false;
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
				const { payments, range } = await searchPaymentsWithConfig();
				const tag = new Date().toISOString().slice(0, 10);
				const result = await generateFiles(payments as any[], tag, range);
				try {
					const mpPath = (result as any)?.files?.mpDbfPath;
					if (mpPath && fs.existsSync(mpPath)) {
						const { sendDbf } = await import('./services/FtpService');
						const ftpResult = await sendDbf(mpPath, 'mp.dbf');
						if (ftpResult.skipped) {
							if (mainWindow) mainWindow.webContents.send('auto-report-notice', { info: `FTP: sin cambios - no se envía` });
						} else {
							if (mainWindow) mainWindow.webContents.send('auto-report-notice', { info: `FTP: enviado OK` });
						}
					}
				} catch (e) {
					if (mainWindow) mainWindow.webContents.send('auto-report-notice', { error: `FTP: ${String((e as any)?.message || e)}` });
				}
				if (mainWindow) {
					const uiRows = (payments as any[]).slice(0, 1000).map((p: any) => ({
						id: p?.id,
						status: p?.status,
						amount: p?.transaction_amount,
						date: p?.date_created,
						method: p?.payment_method_id
					}));
					mainWindow.webContents.send('auto-report-notice', { when: new Date().toISOString(), count: (payments as any[]).length, rows: uiRows.slice(0,8) });
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

	// ===== HANDLERS DE LICENCIA =====

	ipcMain.handle('license:status', async () => {
		return { ok: licenciaExisteYValida() };
	});

	ipcMain.handle('license:generate', async (_e, { nombreCliente }: { nombreCliente: string }) => {
		return { serial: generarSerial(nombreCliente || '') };
	});

	ipcMain.handle('license:validate', async (_e, { nombreCliente, serial }: { nombreCliente: string; serial: string }) => {
		return { ok: validarSerial(nombreCliente || '', serial || '') };
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
