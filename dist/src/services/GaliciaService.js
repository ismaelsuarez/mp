"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.galiciaService = void 0;
exports.getGaliciaSaldos = getGaliciaSaldos;
exports.getGaliciaMovimientos = getGaliciaMovimientos;
exports.crearGaliciaCobranza = crearGaliciaCobranza;
exports.getGaliciaCobros = getGaliciaCobros;
exports.testGaliciaConnection = testGaliciaConnection;
const electron_1 = require("electron");
const fs_1 = __importDefault(require("fs"));
const path_1 = __importDefault(require("path"));
const electron_store_1 = __importDefault(require("electron-store"));
const ErrorNotificationService_1 = require("./ErrorNotificationService");
const LogService_1 = require("./LogService");
const axios_1 = __importDefault(require("axios"));
class GaliciaService {
    constructor() {
        this.client = null;
        this.accessToken = null;
        this.tokenExpiry = 0;
        this.store = new electron_store_1.default({ name: 'settings', encryptionKey: this.getEncryptionKey() });
    }
    getEncryptionKey() {
        try {
            const configPath = path_1.default.join(electron_1.app.getPath('userData'), 'config.key');
            if (fs_1.default.existsSync(configPath)) {
                return fs_1.default.readFileSync(configPath, 'utf8');
            }
            // Si no existe, crear una nueva clave
            const key = require('crypto').randomBytes(32).toString('hex');
            fs_1.default.writeFileSync(configPath, key);
            return key;
        }
        catch (error) {
            (0, LogService_1.logError)('Error al obtener clave de encriptación', { error: String(error) });
            return 'default-encryption-key-32-chars-long';
        }
    }
    getConfig() {
        const config = this.store.get('config') || {};
        return {
            appId: config.GALICIA_APP_ID || '',
            appKey: config.GALICIA_APP_KEY || '',
            certPath: config.GALICIA_CERT_PATH || '',
            keyPath: config.GALICIA_KEY_PATH || '',
            environment: config.GALICIA_ENVIRONMENT || 'sandbox'
        };
    }
    getBaseUrl() {
        const config = this.getConfig();
        return config.environment === 'production'
            ? 'https://api.galicia.ar'
            : 'https://sandbox-api.galicia.ar';
    }
    async authenticate() {
        try {
            const config = this.getConfig();
            if (!config.appId || !config.appKey) {
                throw new Error('AppID y AppKey son requeridos');
            }
            // Verificar si el token actual es válido
            if (this.accessToken && Date.now() < this.tokenExpiry) {
                return true;
            }
            // Configurar cliente HTTP con certificados si están disponibles
            const httpsAgent = config.certPath && config.keyPath && fs_1.default.existsSync(config.certPath) && fs_1.default.existsSync(config.keyPath)
                ? {
                    cert: fs_1.default.readFileSync(config.certPath),
                    key: fs_1.default.readFileSync(config.keyPath),
                    rejectUnauthorized: false
                }
                : undefined;
            this.client = axios_1.default.create({
                baseURL: this.getBaseUrl(),
                httpsAgent,
                timeout: 30000
            });
            // Obtener token de acceso
            const authResponse = await this.client.post('/oauth/token', {
                grant_type: 'client_credentials',
                client_id: config.appId,
                client_secret: config.appKey
            }, {
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                }
            });
            this.accessToken = authResponse.data.access_token;
            this.tokenExpiry = Date.now() + (authResponse.data.expires_in * 1000);
            (0, LogService_1.logSuccess)('Autenticación con Galicia exitosa', {
                environment: config.environment,
                expiresIn: authResponse.data.expires_in
            });
            return true;
        }
        catch (error) {
            const errorMsg = `Error de autenticación con Galicia: ${error.message}`;
            (0, LogService_1.logError)(errorMsg, { error: String(error) });
            (0, ErrorNotificationService_1.recordError)('GALICIA_AUTH_ERROR', errorMsg, { error: String(error) });
            return false;
        }
    }
    async getSaldos() {
        try {
            if (!await this.authenticate()) {
                throw new Error('No se pudo autenticar con Galicia');
            }
            const response = await this.client.get('/api/v1/accounts/balances');
            (0, LogService_1.logInfo)('Saldos obtenidos de Galicia', { count: response.data.length });
            return response.data.map((item) => ({
                cuenta: item.accountNumber,
                moneda: item.currency,
                saldoDisponible: this.formatCurrency(item.availableBalance),
                saldoContable: this.formatCurrency(item.accountBalance)
            }));
        }
        catch (error) {
            const errorMsg = `Error al obtener saldos de Galicia: ${error.message}`;
            (0, LogService_1.logError)(errorMsg, { error: String(error) });
            (0, ErrorNotificationService_1.recordError)('GALICIA_SALDOS_ERROR', errorMsg, { error: String(error) });
            // En modo sandbox, devolver datos simulados
            if (this.getConfig().environment === 'sandbox') {
                return [
                    {
                        cuenta: '001-123456/7',
                        moneda: 'ARS',
                        saldoDisponible: '$ 250.000,00',
                        saldoContable: '$ 260.000,00'
                    }
                ];
            }
            throw error;
        }
    }
    async getMovimientos() {
        try {
            if (!await this.authenticate()) {
                throw new Error('No se pudo autenticar con Galicia');
            }
            const response = await this.client.get('/api/v1/accounts/transactions');
            (0, LogService_1.logInfo)('Movimientos obtenidos de Galicia', { count: response.data.length });
            return response.data.map((item) => ({
                fecha: item.date,
                descripcion: item.description,
                importe: this.formatCurrency(item.amount),
                saldo: this.formatCurrency(item.balance)
            }));
        }
        catch (error) {
            const errorMsg = `Error al obtener movimientos de Galicia: ${error.message}`;
            (0, LogService_1.logError)(errorMsg, { error: String(error) });
            (0, ErrorNotificationService_1.recordError)('GALICIA_MOVIMIENTOS_ERROR', errorMsg, { error: String(error) });
            // En modo sandbox, devolver datos simulados
            if (this.getConfig().environment === 'sandbox') {
                return [
                    {
                        fecha: '2025-01-20',
                        descripcion: 'Transferencia recibida',
                        importe: '+ $ 50.000,00',
                        saldo: '$ 250.000,00'
                    },
                    {
                        fecha: '2025-01-18',
                        descripcion: 'Pago de servicios',
                        importe: '- $ 10.000,00',
                        saldo: '$ 200.000,00'
                    }
                ];
            }
            throw error;
        }
    }
    async crearCobranza(data) {
        try {
            if (!await this.authenticate()) {
                throw new Error('No se pudo autenticar con Galicia');
            }
            const response = await this.client.post('/api/v1/collections', {
                customerName: data.cliente,
                amount: data.monto,
                dueDate: data.vencimiento,
                description: `Cobranza para ${data.cliente}`
            });
            (0, LogService_1.logSuccess)('Cobranza creada en Galicia', {
                id: response.data.id,
                cliente: data.cliente,
                monto: data.monto
            });
            return response.data.id;
        }
        catch (error) {
            const errorMsg = `Error al crear cobranza en Galicia: ${error.message}`;
            (0, LogService_1.logError)(errorMsg, { error: String(error), data });
            (0, ErrorNotificationService_1.recordError)('GALICIA_COBRANZA_ERROR', errorMsg, { error: String(error), data });
            // En modo sandbox, devolver ID simulado
            if (this.getConfig().environment === 'sandbox') {
                return `SIM-${Date.now()}`;
            }
            throw error;
        }
    }
    async getCobros() {
        try {
            if (!await this.authenticate()) {
                throw new Error('No se pudo autenticar con Galicia');
            }
            const response = await this.client.get('/api/v1/collections');
            (0, LogService_1.logInfo)('Cobranzas obtenidas de Galicia', { count: response.data.length });
            return response.data.map((item) => ({
                id: item.id,
                cliente: item.customerName,
                monto: this.formatCurrency(item.amount),
                estado: this.mapEstado(item.status),
                fechaCreacion: item.createdAt,
                fechaVencimiento: item.dueDate
            }));
        }
        catch (error) {
            const errorMsg = `Error al obtener cobranzas de Galicia: ${error.message}`;
            (0, LogService_1.logError)(errorMsg, { error: String(error) });
            (0, ErrorNotificationService_1.recordError)('GALICIA_COBROS_ERROR', errorMsg, { error: String(error) });
            // En modo sandbox, devolver datos simulados
            if (this.getConfig().environment === 'sandbox') {
                return [
                    {
                        id: '101',
                        cliente: 'Cliente A',
                        monto: '$ 30.000,00',
                        estado: 'pendiente',
                        fechaCreacion: '2025-01-15',
                        fechaVencimiento: '2025-02-15'
                    }
                ];
            }
            throw error;
        }
    }
    async testConnection() {
        try {
            const config = this.getConfig();
            if (!config.appId || !config.appKey) {
                return {
                    success: false,
                    message: 'AppID y AppKey son requeridos'
                };
            }
            if (config.certPath && !fs_1.default.existsSync(config.certPath)) {
                return {
                    success: false,
                    message: `Certificado no encontrado en: ${config.certPath}`
                };
            }
            if (config.keyPath && !fs_1.default.existsSync(config.keyPath)) {
                return {
                    success: false,
                    message: `Clave privada no encontrada en: ${config.keyPath}`
                };
            }
            // Intentar autenticación
            const authSuccess = await this.authenticate();
            if (!authSuccess) {
                return {
                    success: false,
                    message: 'Error de autenticación con la API de Galicia'
                };
            }
            return {
                success: true,
                message: `Conexión exitosa con Galicia (${config.environment})`
            };
        }
        catch (error) {
            return {
                success: false,
                message: `Error de conexión: ${error.message}`
            };
        }
    }
    formatCurrency(amount) {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(amount);
    }
    mapEstado(status) {
        switch (status.toLowerCase()) {
            case 'paid':
            case 'pagada':
                return 'pagada';
            case 'expired':
            case 'vencida':
                return 'vencida';
            default:
                return 'pendiente';
        }
    }
}
exports.galiciaService = new GaliciaService();
// Funciones exportadas para IPC
async function getGaliciaSaldos() {
    return await exports.galiciaService.getSaldos();
}
async function getGaliciaMovimientos() {
    return await exports.galiciaService.getMovimientos();
}
async function crearGaliciaCobranza(data) {
    return await exports.galiciaService.crearCobranza(data);
}
async function getGaliciaCobros() {
    return await exports.galiciaService.getCobros();
}
async function testGaliciaConnection() {
    return await exports.galiciaService.testConnection();
}
