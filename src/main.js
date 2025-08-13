const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Store = require('electron-store');
const { searchPaymentsWithConfig } = require('./services/MercadoPagoService');
const { generateFiles, getOutDir } = require('./services/ReportService');
const { sendReportEmail } = require('./services/EmailService');

let mainWindow = null;

function getEncryptionKey() {
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
		// Fallback sin encriptación si falla filesystem
		return undefined;
	}
}

const store = new Store({ name: 'settings', encryptionKey: getEncryptionKey() });

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

	mainWindow.loadFile(path.join(__dirname, '..', 'public', 'index.html'));

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
	ipcMain.handle('save-config', (event, cfg) => {
		if (cfg && typeof cfg === 'object') {
			store.set('config', cfg);
			return true;
		}
		return false;
	});

	// Generar reporte bajo demanda
	ipcMain.handle('generate-report', async () => {
		const { payments, range } = await searchPaymentsWithConfig();
		const tag = new Date().toISOString().slice(0, 10);
		const result = await generateFiles(payments, tag, range);
		return { count: payments.length, outDir: result.outDir, files: result.files };
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
		].filter(f => fs.existsSync(f.path));
		const sent = await sendReportEmail(`MP Reporte ${today}`, `Adjunto reporte de ${today}`, files);
		return { sent, files: files.map(f => f.filename) };
	});

	createMainWindow();

	app.on('activate', () => {
		if (BrowserWindow.getAllWindows().length === 0) createMainWindow();
	});
});

app.on('window-all-closed', () => {
	if (process.platform !== 'darwin') {
		app.quit();
	}
});


