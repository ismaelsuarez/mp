import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('api', {
	async getConfig() {
		return await ipcRenderer.invoke('get-config');
	},
	async saveConfig(cfg: any) {
		return await ipcRenderer.invoke('save-config', cfg);
	},
	async generateReport() {
		return await ipcRenderer.invoke('generate-report');
	},
	async exportReport() {
		return await ipcRenderer.invoke('export-report');
	},
	async sendReportEmail() {
		return await ipcRenderer.invoke('send-report-email');
	},
	async testFtpConnection() {
		return await ipcRenderer.invoke('test-ftp');
	},
	async sendDbfViaFtp() {
		return await ipcRenderer.invoke('send-dbf-ftp');
	},
	async clearFtpHash() {
		return await ipcRenderer.invoke('clear-ftp-hash');
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
	async testConnection() {
		return await ipcRenderer.invoke('test-connection');
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
	async openView(view: 'config' | 'caja') {
		console.log('[preload] openView invoked with', view);
		const res = await ipcRenderer.invoke('open-view', view);
		console.log('[preload] openView result', res);
		return res;
	},
	async setWindowSize(width: number, height: number) {
		return await ipcRenderer.invoke('set-window-size', { width, height });
	}
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
	async generate(nombreCliente: string) {
		return await ipcRenderer.invoke('license:generate', { nombreCliente });
	},
	async validate(nombreCliente: string, serial: string) {
		return await ipcRenderer.invoke('license:validate', { nombreCliente, serial });
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