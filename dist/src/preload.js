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
    // Nota: no es necesario exponer nuevos IPC; se reutiliza save-config para activar watchers
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
    async ftpSendFile(localPath, remoteName) {
        return await electron_1.ipcRenderer.invoke('ftp:send-file', { localPath, remoteName });
    },
    async clearFtpHash() {
        return await electron_1.ipcRenderer.invoke('clear-ftp-hash');
    },
    // Error Notifications
    async getErrorNotificationConfig() {
        return await electron_1.ipcRenderer.invoke('error-notifications:get-config');
    },
    async updateErrorNotificationConfig(config) {
        return await electron_1.ipcRenderer.invoke('error-notifications:update-config', config);
    },
    async getErrorNotificationSummary() {
        return await electron_1.ipcRenderer.invoke('error-notifications:get-summary');
    },
    async clearOldErrors(hours = 24) {
        return await electron_1.ipcRenderer.invoke('error-notifications:clear-old', hours);
    },
    async resetErrorNotifications() {
        return await electron_1.ipcRenderer.invoke('error-notifications:reset');
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
    async pauseAuto() {
        return await electron_1.ipcRenderer.invoke('auto-pause');
    },
    async resumeAuto() {
        return await electron_1.ipcRenderer.invoke('auto-resume');
    },
    async getAutoTimer() {
        return await electron_1.ipcRenderer.invoke('auto-get-timer');
    },
    onAutoNotice(callback) {
        electron_1.ipcRenderer.on('auto-report-notice', (_e, payload) => callback(payload));
    },
    onAutoTimerUpdate(callback) {
        electron_1.ipcRenderer.on('auto-timer-update', (_e, payload) => callback(payload));
    },
    async testConnection() {
        return await electron_1.ipcRenderer.invoke('test-connection');
    },
    async validateRemoteDir(dirPath) {
        return await electron_1.ipcRenderer.invoke('auto-remote:validate-dir', dirPath);
    },
    async runRemoteOnce() {
        return await electron_1.ipcRenderer.invoke('auto-remote:run-once');
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
    },
    async getAppVersion() {
        return await electron_1.ipcRenderer.invoke('get-app-version');
    },
    async getReleaseNotes() {
        return await electron_1.ipcRenderer.invoke('about:get-release-notes');
    },
    // FTP Server controls
    async ftpStart(cfg) { return await electron_1.ipcRenderer.invoke('ftp-server:start', cfg); },
    async ftpStop() { return await electron_1.ipcRenderer.invoke('ftp-server:stop'); },
    async ftpStatus() { return await electron_1.ipcRenderer.invoke('ftp-server:status'); },
    // Image Mode functions
    async testImageControl() {
        return await electron_1.ipcRenderer.invoke('image:test-control');
    },
    onNewImageContent(callback) {
        electron_1.ipcRenderer.on('image:new-content', (_e, payload) => callback(payload));
    },
    // Utils
    async openPath(fullPath) {
        return await electron_1.ipcRenderer.invoke('open-path', fullPath);
    },
    // Facturación
    facturacion: {
        guardarConfig: (cfg) => electron_1.ipcRenderer.invoke('facturacion:guardar-config', cfg),
        emitir: (payload) => electron_1.ipcRenderer.invoke('facturacion:emitir', payload),
        listar: (filtros) => electron_1.ipcRenderer.invoke('facturacion:listar', filtros || {}),
        abrirPdf: (filePath) => electron_1.ipcRenderer.invoke('facturacion:abrir-pdf', filePath),
        empresaGet: () => electron_1.ipcRenderer.invoke('facturacion:empresa:get'),
        empresaSave: (data) => electron_1.ipcRenderer.invoke('facturacion:empresa:save', data),
        paramGet: () => electron_1.ipcRenderer.invoke('facturacion:param:get'),
        paramSave: (data) => electron_1.ipcRenderer.invoke('facturacion:param:save', data),
        listarPdfs: () => electron_1.ipcRenderer.invoke('facturacion:pdfs'),
        // Validación de CAE
        validateCAE: (facturaId, operation) => electron_1.ipcRenderer.invoke('facturacion:validate-cae', { facturaId, operation }),
        validateCAEComprobante: (numero, ptoVta, tipoCbte, operation) => electron_1.ipcRenderer.invoke('facturacion:validate-cae-comprobante', { numero, ptoVta, tipoCbte, operation }),
        getCAEStatus: (facturaId) => electron_1.ipcRenderer.invoke('facturacion:get-cae-status', { facturaId }),
        getCAEStatusComprobante: (numero, ptoVta, tipoCbte) => electron_1.ipcRenderer.invoke('facturacion:get-cae-status-comprobante', { numero, ptoVta, tipoCbte }),
        findExpiringCAE: (warningThresholdHours) => electron_1.ipcRenderer.invoke('facturacion:find-expiring-cae', { warningThresholdHours }),
        findExpiredCAE: () => electron_1.ipcRenderer.invoke('facturacion:find-expired-cae'),
        // Emisión con provincias
        emitirConProvincias: (payload) => electron_1.ipcRenderer.invoke('facturacion:emitir-con-provincias', payload),
        // Diagnóstico
        listarPuntosDeVenta: () => electron_1.ipcRenderer.invoke('facturacion:listar-ptos-vta')
    },
    // AFIP
    'afip:check-server-status': () => electron_1.ipcRenderer.invoke('afip:check-server-status'),
    'afip:validar-certificado': () => electron_1.ipcRenderer.invoke('afip:validar-certificado'),
    'afip:clear-ta': () => electron_1.ipcRenderer.invoke('afip:clear-ta'),
    // Gestión Provincial
    provincia: {
        getConfiguracion: () => electron_1.ipcRenderer.invoke('provincia:get-configuracion'),
        actualizarConfiguracion: (jurisdiccion, config) => electron_1.ipcRenderer.invoke('provincia:actualizar-configuracion', { jurisdiccion, config }),
        getEstadisticas: () => electron_1.ipcRenderer.invoke('provincia:get-estadisticas'),
        recargarConfiguracion: () => electron_1.ipcRenderer.invoke('provincia:recargar-configuracion')
    },
    // Perfiles de configuración
    perfiles: {
        list: () => electron_1.ipcRenderer.invoke('perfiles:list'),
        get: (id) => electron_1.ipcRenderer.invoke('perfiles:get', id),
        save: (perfil) => electron_1.ipcRenderer.invoke('perfiles:save', perfil),
        remove: (id) => electron_1.ipcRenderer.invoke('perfiles:delete', id)
    },
    // Galicia
    galicia: {
        getSaldos: () => electron_1.ipcRenderer.invoke('galicia:get-saldos'),
        getMovimientos: () => electron_1.ipcRenderer.invoke('galicia:get-movimientos'),
        crearCobranza: (data) => electron_1.ipcRenderer.invoke('galicia:crear-cobranza', data),
        getCobros: () => electron_1.ipcRenderer.invoke('galicia:get-cobros'),
        testConnection: () => electron_1.ipcRenderer.invoke('galicia:test-connection')
    },
});
// Exponer funciones de autenticación
electron_1.contextBridge.exposeInMainWorld('auth', {
    async isInitialized() {
        return await electron_1.ipcRenderer.invoke('auth:is-initialized');
    },
    async getPolicy() {
        return await electron_1.ipcRenderer.invoke('auth:get-policy');
    },
    async setup(data) {
        return await electron_1.ipcRenderer.invoke('auth:setup', data);
    },
    async login(creds) {
        return await electron_1.ipcRenderer.invoke('auth:login', creds);
    },
    async change(data) {
        return await electron_1.ipcRenderer.invoke('auth:change', data);
    },
    async requestOtp() {
        return await electron_1.ipcRenderer.invoke('auth:request-otp');
    },
    async resetByOtp(data) {
        return await electron_1.ipcRenderer.invoke('auth:reset-by-otp', data);
    },
    async resetBySecret(data) {
        return await electron_1.ipcRenderer.invoke('auth:reset-by-secret', data);
    },
    async openConfig() {
        return await electron_1.ipcRenderer.invoke('auth:open-config');
    }
});
// Exponer funciones de licencia
electron_1.contextBridge.exposeInMainWorld('license', {
    async status() {
        return await electron_1.ipcRenderer.invoke('license:status');
    },
    async validate(nombreCliente, palabraSecreta, serial) {
        return await electron_1.ipcRenderer.invoke('license:validate', { nombreCliente, palabraSecreta, serial });
    },
    async save(payload) {
        return await electron_1.ipcRenderer.invoke('license:save', payload);
    },
    async load() {
        return await electron_1.ipcRenderer.invoke('license:load');
    },
    async recover(nombreCliente, palabraSecreta) {
        return await electron_1.ipcRenderer.invoke('license:recover', { nombreCliente, palabraSecreta });
    },
    async openHome() {
        return await electron_1.ipcRenderer.invoke('license:open-home');
    }
});
