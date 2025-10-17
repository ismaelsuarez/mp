import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
	async getConfig() {
		return await ipcRenderer.invoke('get-config');
	},
	async saveConfig(cfg: any) {
		return await ipcRenderer.invoke('save-config', cfg);
	},
	// Nota: no es necesario exponer nuevos IPC; se reutiliza save-config para activar watchers
	async generateReport() {
		return await ipcRenderer.invoke('generate-report');
	},
	async exportReport() {
		return await ipcRenderer.invoke('export-report');
	},
	async sendReportEmail() {
		return await ipcRenderer.invoke('send-report-email');
	},
	async testEmailSmtp() {
		return await ipcRenderer.invoke('test-email-smtp');
	},
	async testFtpConnection() {
		return await ipcRenderer.invoke('test-ftp');
	},
	async testFtpWhatsappConnection() {
		return await ipcRenderer.invoke('test-ftp-whatsapp');
	},
	async sendDbfViaFtp() {
		return await ipcRenderer.invoke('send-dbf-ftp');
	},
	async ftpSendFile(localPath: string, remoteName?: string) {
		return await ipcRenderer.invoke('ftp:send-file', { localPath, remoteName });
	},
	async ftpSendWhatsappFile(localPath: string, remoteName?: string) {
		return await ipcRenderer.invoke('ftp:send-file-whatsapp', { localPath, remoteName });
	},
	async clearFtpHash() {
		return await ipcRenderer.invoke('clear-ftp-hash');
	},
	// FTP Mercado Pago (config separada)
	mpFtp: {
		test: () => ipcRenderer.invoke('mp-ftp:test'),
		sendMpDbf: () => ipcRenderer.invoke('mp-ftp:send-dbf'),
		saveConfig: (cfg: any) => ipcRenderer.invoke('mp-ftp:save-config', cfg),
		getConfig: () => ipcRenderer.invoke('mp-ftp:get-config'),
	},
	// Error Notifications
	async getErrorNotificationConfig() {
		return await ipcRenderer.invoke('error-notifications:get-config');
	},
	async updateErrorNotificationConfig(config: any) {
		return await ipcRenderer.invoke('error-notifications:update-config', config);
	},
	async getErrorNotificationSummary() {
		return await ipcRenderer.invoke('error-notifications:get-summary');
	},
	async clearOldErrors(hours: number = 24) {
		return await ipcRenderer.invoke('error-notifications:clear-old', hours);
	},
	async resetErrorNotifications() {
		return await ipcRenderer.invoke('error-notifications:reset');
	},
	async autoStart() {
		return await ipcRenderer.invoke('auto-start');
	},
	async autoStop() {
		return await ipcRenderer.invoke('auto-stop');
	},
	async autoStatus() {
		return await ipcRenderer.invoke('auto-status');
	},
	async pauseAuto() {
		return await ipcRenderer.invoke('auto-pause');
	},
	async resumeAuto() {
		return await ipcRenderer.invoke('auto-resume');
	},
	async getAutoTimer() {
		return await ipcRenderer.invoke('auto-get-timer');
	},
	onAutoNotice(callback: (payload: any) => void) {
		ipcRenderer.on('auto-report-notice', (_e, payload) => callback(payload));
	},
	onAutoTimerUpdate(callback: (payload: any) => void) {
		ipcRenderer.on('auto-timer-update', (_e, payload) => callback(payload));
	},
    onWsHealth(callback: (payload: { status: 'up'|'degraded'|'down'; at?: number; details?: any }) => void) {
        ipcRenderer.on('ws-health-update', (_e, payload) => callback(payload));
    },
	onCajaLog(callback: (message: string) => void) {
		ipcRenderer.on('caja-log', (_e, message) => callback(message));
	},
	async testConnection() {
		return await ipcRenderer.invoke('test-connection');
	},
	async validateRemoteDir(dirPath: string) {
		return await ipcRenderer.invoke('auto-remote:validate-dir', dirPath);
	},
	async runRemoteOnce() {
		return await ipcRenderer.invoke('auto-remote:run-once');
	},
	async openOutDir() {
		return await ipcRenderer.invoke('open-out-dir');
	},
  async openTodayLog() {
    return await ipcRenderer.invoke('open-today-log');
  },
	async listHistory() {
		return await ipcRenderer.invoke('list-history');
	},
	async openView(view: 'config' | 'caja' | 'imagen' | 'galicia') {
		console.log('[preload] openView invoked with', view);
		const res = await ipcRenderer.invoke('open-view', view);
		console.log('[preload] openView result', res);
		return res;
	},
	async setWindowSize(width: number, height: number) {
		return await ipcRenderer.invoke('set-window-size', { width, height });
	},
	async getAppVersion() {
		return await ipcRenderer.invoke('get-app-version');
	},
	async getReleaseNotes() {
		return await ipcRenderer.invoke('about:get-release-notes');
	},
	// FTP Server controls
	async ftpStart(cfg: any) { return await ipcRenderer.invoke('ftp-server:start', cfg); },
	async ftpStop() { return await ipcRenderer.invoke('ftp-server:stop'); },
	async ftpStatus() { return await ipcRenderer.invoke('ftp-server:status'); },
	// Image Mode functions
	async testImageControl() {
		return await ipcRenderer.invoke('image:test-control');
	},
	onNewImageContent(callback: (payload: { 
		filePath: string; 
		info?: string; 
		windowMode?: string;
		isNumeradorMode?: boolean;
		numeradorValue?: string;
	}) => void) {
		ipcRenderer.on('image:new-content', (_e, payload) => callback(payload));
	},
	// Utils
	async openPath(fullPath: string) {
		return await ipcRenderer.invoke('open-path', fullPath);
	},
	// Facturación
	facturacion: {
		// Configuración AFIP persistente (RI)
		afipGet: () => ipcRenderer.invoke('facturacion:afip:get'),
		afipSave: (cfg: any) => ipcRenderer.invoke('facturacion:afip:save', cfg),
		emitir: (payload: any) => ipcRenderer.invoke('facturacion:emitir', payload),
		listar: (filtros?: { desde?: string; hasta?: string }) => ipcRenderer.invoke('facturacion:listar', filtros || {}),
		abrirPdf: (filePath: string) => ipcRenderer.invoke('facturacion:abrir-pdf', filePath),
		empresaGet: () => ipcRenderer.invoke('facturacion:empresa:get'),
		empresaSave: (data: any) => ipcRenderer.invoke('facturacion:empresa:save', data),
		paramGet: () => ipcRenderer.invoke('facturacion:param:get'),
		paramSave: (data: any) => ipcRenderer.invoke('facturacion:param:save', data),
		listarPdfs: () => ipcRenderer.invoke('facturacion:pdfs'),
		// Cotización Moneda (AFIP)
		getCotizacionMoneda: (args?: { monIdText?: string; modo?: 'ULTIMA'|'HABIL_ANTERIOR'; baseDate?: string }) => ipcRenderer.invoke('cotizacion:get', args || {}),
		// Idempotencia
		idempotencyList: () => ipcRenderer.invoke('facturacion:idempotency:list'),
		idempotencyCleanup: () => ipcRenderer.invoke('facturacion:idempotency:cleanup'),
		// Validación de CAE
		validateCAE: (facturaId: number, operation: string) => ipcRenderer.invoke('facturacion:validate-cae', { facturaId, operation }),
		validateCAEComprobante: (numero: number, ptoVta: number, tipoCbte: number, operation: string) => ipcRenderer.invoke('facturacion:validate-cae-comprobante', { numero, ptoVta, tipoCbte, operation }),
		getCAEStatus: (facturaId: number) => ipcRenderer.invoke('facturacion:get-cae-status', { facturaId }),
		getCAEStatusComprobante: (numero: number, ptoVta: number, tipoCbte: number) => ipcRenderer.invoke('facturacion:get-cae-status-comprobante', { numero, ptoVta, tipoCbte }),
		findExpiringCAE: (warningThresholdHours?: number) => ipcRenderer.invoke('facturacion:find-expiring-cae', { warningThresholdHours }),
		findExpiredCAE: () => ipcRenderer.invoke('facturacion:find-expired-cae'),
		// Emisión con provincias
		emitirConProvincias: (payload: any) => ipcRenderer.invoke('facturacion:emitir-con-provincias', payload),
		// Padrón 13
		padron13Consultar: (cuit: number) => ipcRenderer.invoke('facturacion:padron13:consulta', { cuit }),
		padron13Ping: () => ipcRenderer.invoke('facturacion:padron13:ping'),
		// FECRED/MiPyME
		fceConsultarObligado: (cuit: number) => ipcRenderer.invoke('facturacion:fce:consultar-obligado', { cuit }),
		// Diagnóstico
		listarPuntosDeVenta: () => ipcRenderer.invoke('facturacion:listar-ptos-vta'),
		// Watcher .fac
		getWatcherDir: () => ipcRenderer.invoke('facturacion:config:get-watcher-dir'),
		setWatcherDir: (dir: string, enabled?: boolean) => ipcRenderer.invoke('facturacion:config:set-watcher-dir', { dir, enabled }),
		onFacDetected: (callback: (payload: { filename: string; rawContent: string }) => void) => {
			ipcRenderer.on('facturacion:fac:detected', (_e, payload) => callback(payload));
		}
	},
	// Retenciones (config simple)
	retencion: {
		getConfig: () => ipcRenderer.invoke('retencion:get-config'),
		saveConfig: (cfg: { outLocal?: string; outRed1?: string; outRed2?: string }) => ipcRenderer.invoke('retencion:save-config', cfg),
	},
	// Caja resumen diario
	caja: {
		getSummary: (fechaIso: string) => ipcRenderer.invoke('caja:get-summary', { fechaIso }),
		cleanupRes: (options?: { daysToKeep?: number; dryRun?: boolean }) => ipcRenderer.invoke('caja:cleanup-res', options),
		openDir: (kind: 'processing'|'done'|'error'|'out') => ipcRenderer.invoke('caja:open-dir', { kind }),
		getLogs: (options?: { sinceMs?: number; limit?: number }) => ipcRenderer.invoke('caja:get-logs', options || {}),
		// Control del watcher .fac
		watcherPause: () => ipcRenderer.invoke('caja:watcher:pause'),
		watcherResume: () => ipcRenderer.invoke('caja:watcher:resume'),
		watcherStatus: () => ipcRenderer.invoke('caja:watcher:status')
	},
	// Recibo config (PV y contador)
	recibo: {
		getConfig: () => ipcRenderer.invoke('recibo:get-config'),
		saveConfig: (cfg: { pv?: number; contador?: number; outLocal?: string; outRed1?: string; outRed2?: string }) => ipcRenderer.invoke('recibo:save-config', cfg),
	},
    remito: {
      getConfig: () => ipcRenderer.invoke('remito:get-config'),
      saveConfig: (cfg: { pv?: number; contador?: number; outLocal?: string; outRed1?: string; outRed2?: string; printerName?: string }) => ipcRenderer.invoke('remito:save-config', cfg),
    },
		// Configuración unificada de Facturas (A/B y Notas)
		facturas: {
			getConfig: () => ipcRenderer.invoke('facturas:get-config'),
			saveConfig: (cfg: { pv?: number; outLocal?: string; outRed1?: string; outRed2?: string; printerName?: string }) => ipcRenderer.invoke('facturas:save-config', cfg),
			emitirUi: (payload: any) => ipcRenderer.invoke('facturas:emitir-ui', payload),
		},
    		// [limpieza] Se elimina objeto legacy facturaA (UI usa window.api.facturas)
	printers: {
		list: () => ipcRenderer.invoke('printers:list'),
		printPdf: (filePath: string, printerName?: string, copies?: number) => ipcRenderer.invoke('printers:print-pdf', { filePath, printerName, copies }),
	},
	// AFIP
	'afip:check-server-status': () => ipcRenderer.invoke('afip:check-server-status'),
	'afip:validar-certificado': () => ipcRenderer.invoke('afip:validar-certificado'),
	'afip:clear-ta': () => ipcRenderer.invoke('afip:clear-ta'),
	'afip:clear-config': () => ipcRenderer.invoke('afip:clear-config'),
	'db:reset': () => ipcRenderer.invoke('db:reset'),
	'secure:import-cert-key': (certPath: string, keyPath: string) => ipcRenderer.invoke('secure:import-cert-key', { certPath, keyPath }),
	'secure:write-temp-afip': () => ipcRenderer.invoke('secure:write-temp-afip'),
	// Gestión Provincial
	provincia: {
		getConfiguracion: () => ipcRenderer.invoke('provincia:get-configuracion'),
		actualizarConfiguracion: (jurisdiccion: string, config: any) => ipcRenderer.invoke('provincia:actualizar-configuracion', { jurisdiccion, config }),
		getEstadisticas: () => ipcRenderer.invoke('provincia:get-estadisticas'),
		recargarConfiguracion: () => ipcRenderer.invoke('provincia:recargar-configuracion')
	},
	// Perfiles de configuración
	perfiles: {
		list: () => ipcRenderer.invoke('perfiles:list'),
		get: (id: number) => ipcRenderer.invoke('perfiles:get', id),
		save: (perfil: any) => ipcRenderer.invoke('perfiles:save', perfil),
		remove: (id: number) => ipcRenderer.invoke('perfiles:delete', id)
	},
	// Galicia
	galicia: {
		getSaldos: () => ipcRenderer.invoke('galicia:get-saldos'),
		getMovimientos: () => ipcRenderer.invoke('galicia:get-movimientos'),
		crearCobranza: (data: { cliente: string; monto: number; vencimiento: string }) => ipcRenderer.invoke('galicia:crear-cobranza', data),
		getCobros: () => ipcRenderer.invoke('galicia:get-cobros'),
		testConnection: () => ipcRenderer.invoke('galicia:test-connection')
	},

});

// Exponer funciones de autenticación
contextBridge.exposeInMainWorld('auth', {
	async isInitialized() {
		return await ipcRenderer.invoke('auth:is-initialized');
	},
	async getPolicy() {
		return await ipcRenderer.invoke('auth:get-policy');
	},
	async setup(data: { username: string; password: string; secretPhrase: string }) {
		return await ipcRenderer.invoke('auth:setup', data);
	},
	async login(creds: { username: string; password: string }) {
		return await ipcRenderer.invoke('auth:login', creds);
	},
	async change(data: { current: string; newPw: string; newUser?: string; newSecret?: string }) {
		return await ipcRenderer.invoke('auth:change', data);
	},
	async requestOtp() {
		return await ipcRenderer.invoke('auth:request-otp');
	},
	async resetByOtp(data: { otp: string; newPw: string }) {
		return await ipcRenderer.invoke('auth:reset-by-otp', data);
	},
	async resetBySecret(data: { secretPhrase: string; newPw: string; newUser?: string }) {
		return await ipcRenderer.invoke('auth:reset-by-secret', data);
	},
	async openConfig() {
		return await ipcRenderer.invoke('auth:open-config');
	}
});

// Exponer funciones de licencia
contextBridge.exposeInMainWorld('license', {
	async status() {
		return await ipcRenderer.invoke('license:status');
	},
	async validate(nombreCliente: string, palabraSecreta: string, serial: string) {
		return await ipcRenderer.invoke('license:validate', { nombreCliente, palabraSecreta, serial });
	},
	async save(payload: { nombreCliente: string; serial: string; palabraSecreta: string }) {
		return await ipcRenderer.invoke('license:save', payload);
	},
	async load() {
		return await ipcRenderer.invoke('license:load');
	},
	async recover(nombreCliente: string, palabraSecreta: string) {
		return await ipcRenderer.invoke('license:recover', { nombreCliente, palabraSecreta });
	},
	async openHome() {
		return await ipcRenderer.invoke('license:open-home');
	}
});

// Exponer ipcRenderer para uso directo en caja.html y otras ventanas
contextBridge.exposeInMainWorld('electron', {
	ipcRenderer: {
		invoke: (channel: string, ...args: any[]) => ipcRenderer.invoke(channel, ...args),
		on: (channel: string, listener: (...args: any[]) => void) => {
			ipcRenderer.on(channel, (_event, ...args) => listener(...args));
		},
		once: (channel: string, listener: (...args: any[]) => void) => {
			ipcRenderer.once(channel, (_event, ...args) => listener(...args));
		},
		removeListener: (channel: string, listener: (...args: any[]) => void) => {
			ipcRenderer.removeListener(channel, listener);
		}
	}
});