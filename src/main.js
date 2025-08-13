const { app, BrowserWindow, ipcMain } = require('electron');
const path = require('path');
const fs = require('fs');
const crypto = require('crypto');
const Store = require('electron-store');
const { searchPaymentsWithConfig } = require('./services/MercadoPagoService');
const { generateFiles } = require('./services/ReportService');

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


