const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
	async getConfig() {
		return await ipcRenderer.invoke('get-config');
	},
	async saveConfig(cfg) {
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
	onAutoNotice(callback) {
		ipcRenderer.on('auto-report-notice', (_e, payload) => callback(payload));
	},
	async testConnection() {
		return await ipcRenderer.invoke('test-connection');
	},
	async openOutDir() {
		return await ipcRenderer.invoke('open-out-dir');
	},
	async listHistory() {
		return await ipcRenderer.invoke('list-history');
	}
});


