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
	async autoStart() {
		return await ipcRenderer.invoke('auto-start');
	},
	async autoStop() {
		return await ipcRenderer.invoke('auto-stop');
	},
	async autoStatus() {
		return await ipcRenderer.invoke('auto-status');
	},
	onAutoNotice(callback: (payload: any) => void) {
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
