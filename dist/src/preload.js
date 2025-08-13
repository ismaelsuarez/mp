"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
const electron_1 = require("electron");
electron_1.contextBridge.exposeInMainWorld('api', {
    async getConfig() {
        return await electron_1.ipcRenderer.invoke('get-config');
    },
    async saveConfig(cfg) {
        return await electron_1.ipcRenderer.invoke('save-config', cfg);
    },
    async generateReport() {
        return await electron_1.ipcRenderer.invoke('generate-report');
    },
    async exportReport() {
        return await electron_1.ipcRenderer.invoke('export-report');
    },
    async sendReportEmail() {
        return await electron_1.ipcRenderer.invoke('send-report-email');
    },
    async testFtpConnection() {
        return await electron_1.ipcRenderer.invoke('test-ftp');
    },
    async sendDbfViaFtp() {
        return await electron_1.ipcRenderer.invoke('send-dbf-ftp');
    },
    async autoStart() {
        return await electron_1.ipcRenderer.invoke('auto-start');
    },
    async autoStop() {
        return await electron_1.ipcRenderer.invoke('auto-stop');
    },
    async autoStatus() {
        return await electron_1.ipcRenderer.invoke('auto-status');
    },
    onAutoNotice(callback) {
        electron_1.ipcRenderer.on('auto-report-notice', (_e, payload) => callback(payload));
    },
    async testConnection() {
        return await electron_1.ipcRenderer.invoke('test-connection');
    },
    async openOutDir() {
        return await electron_1.ipcRenderer.invoke('open-out-dir');
    },
    async openTodayLog() {
        return await electron_1.ipcRenderer.invoke('open-today-log');
    },
    async listHistory() {
        return await electron_1.ipcRenderer.invoke('list-history');
    },
    async openView(view) {
        console.log('[preload] openView invoked with', view);
        const res = await electron_1.ipcRenderer.invoke('open-view', view);
        console.log('[preload] openView result', res);
        return res;
    },
    async setWindowSize(width, height) {
        return await electron_1.ipcRenderer.invoke('set-window-size', { width, height });
    }
});
