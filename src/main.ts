import { app, BrowserWindow, ipcMain, shell } from 'electron';
import path from 'path';
import fs from 'fs';
import crypto from 'crypto';
import Store from 'electron-store';
import cron from 'node-cron';
import { searchPaymentsWithConfig, testConnection } from './services/MercadoPagoService';
import { generateFiles, getOutDir } from './services/ReportService';
import { sendReportEmail } from './services/EmailService';

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
	const htmlPath = path.join(app.getAppPath(), 'public', 'index.html');
	mainWindow.loadFile(htmlPath);

	mainWindow.on('closed', () => {
		mainWindow = null;
	});
}

// Desactivar aceleración por GPU (mejora compatibilidad en WSL/VMs)
app.disableHardwareAcceleration();

app.whenReady().then(() => {
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
		const { payments, range } = await searchPaymentsWithConfig();
		const tag = new Date().toISOString().slice(0, 10);
		const result = await generateFiles(payments as any[], tag, range);
		// Reducir payload para UI
		const uiRows = (payments as any[]).slice(0, 1000).map((p: any) => ({
			id: p?.id,
			status: p?.status,
			amount: p?.transaction_amount,
			date: p?.date_created,
			method: p?.payment_method_id
		}));
		return { count: (payments as any[]).length, outDir: result.outDir, files: result.files, rows: uiRows };
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

	// Abrir carpeta de salida
	ipcMain.handle('open-out-dir', async () => {
		const dir = getOutDir();
		await shell.openPath(dir);
		return { ok: true, dir };
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

	createMainWindow();

	// Programación automática
	function scheduleJobs() {
		const cfg: any = store.get('config') || {};
		if (!cfg.AUTO_ENABLED) return;
		const times = String(cfg.AUTO_TIMES || '').split(',').map((s: string) => s.trim()).filter(Boolean);
		for (const t of times) {
			const m = /^([0-2]?\d):([0-5]\d)$/.exec(t);
			if (!m) continue;
			const hh = Number(m[1]);
			const mm = Number(m[2]);
			const expr = `${mm} ${hh} * * *`;
			cron.schedule(expr, async () => {
				try {
					const { payments, range } = await searchPaymentsWithConfig();
					const tag = new Date().toISOString().slice(0, 10);
					await generateFiles(payments as any[], tag, range);
					if (mainWindow) {
						mainWindow.webContents.send('auto-report-notice', { when: new Date().toISOString(), count: (payments as any[]).length });
					}
				} catch (e: any) {
					if (mainWindow) {
						mainWindow.webContents.send('auto-report-notice', { error: String(e?.message || e) });
					}
				}
			});
		}
	}

	scheduleJobs();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});
