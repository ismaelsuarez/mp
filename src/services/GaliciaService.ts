import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import { recordError } from './ErrorNotificationService';
import { logError, logInfo, logSuccess } from './LogService';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Interfaces para los datos de Galicia
interface GaliciaSaldo {
    cuenta: string;
    moneda: string;
    saldoDisponible: string;
    saldoContable: string;
}

interface GaliciaMovimiento {
    fecha: string;
    descripcion: string;
    importe: string;
    saldo: string;
}

interface GaliciaCobranza {
    id: string;
    cliente: string;
    monto: string;
    estado: 'pendiente' | 'pagada' | 'vencida';
    fechaCreacion: string;
    fechaVencimiento: string;
}

interface GaliciaAuthResponse {
    access_token: string;
    refresh_token: string;
    expires_in: number;
    token_type: string;
}

interface GaliciaConfig {
    appId: string;
    appKey: string;
    certPath: string;
    keyPath: string;
    environment: 'sandbox' | 'production';
}

class GaliciaService {
    private client: AxiosInstance | null = null;
    private accessToken: string | null = null;
    private tokenExpiry: number = 0;
    private store: Store;

    constructor() {
        this.store = new Store({ name: 'settings', encryptionKey: this.getEncryptionKey() });
    }

    private getEncryptionKey(): string {
        try {
            const configPath = path.join(app.getPath('userData'), 'config.key');
            if (fs.existsSync(configPath)) {
                return fs.readFileSync(configPath, 'utf8');
            }
            // Si no existe, crear una nueva clave
            const key = require('crypto').randomBytes(32).toString('hex');
            fs.writeFileSync(configPath, key);
            return key;
        } catch (error) {
            logError('Error al obtener clave de encriptación', { error: String(error) });
            return 'default-encryption-key-32-chars-long';
        }
    }

    private getConfig(): GaliciaConfig {
        const config = this.store.get('config') as any || {};
        return {
            appId: config.GALICIA_APP_ID || '',
            appKey: config.GALICIA_APP_KEY || '',
            certPath: config.GALICIA_CERT_PATH || '',
            keyPath: config.GALICIA_KEY_PATH || '',
            environment: config.GALICIA_ENVIRONMENT || 'sandbox'
        };
    }

    private getBaseUrl(): string {
        const config = this.getConfig();
        return config.environment === 'production' 
            ? 'https://api.galicia.ar' 
            : 'https://sandbox-api.galicia.ar';
    }

    private async authenticate(): Promise<boolean> {
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
            const httpsAgent = config.certPath && config.keyPath && fs.existsSync(config.certPath) && fs.existsSync(config.keyPath)
                ? {
                    cert: fs.readFileSync(config.certPath),
                    key: fs.readFileSync(config.keyPath),
                    rejectUnauthorized: false
                }
                : undefined;

            this.client = axios.create({
                baseURL: this.getBaseUrl(),
                httpsAgent,
                timeout: 30000
            });

            // Obtener token de acceso
            const authResponse = await this.client.post<GaliciaAuthResponse>('/oauth/token', {
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

            logSuccess('Autenticación con Galicia exitosa', { 
                environment: config.environment,
                expiresIn: authResponse.data.expires_in 
            });

            return true;
        } catch (error: any) {
            const errorMsg = `Error de autenticación con Galicia: ${error.message}`;
            logError(errorMsg, { error: String(error) });
            recordError('GALICIA_AUTH_ERROR', errorMsg, { error: String(error) });
            return false;
        }
    }

    async getSaldos(): Promise<GaliciaSaldo[]> {
        try {
            if (!await this.authenticate()) {
                throw new Error('No se pudo autenticar con Galicia');
            }

            const response = await this.client!.get('/api/v1/accounts/balances');
            
            logInfo('Saldos obtenidos de Galicia', { count: response.data.length });
            
            return response.data.map((item: any) => ({
                cuenta: item.accountNumber,
                moneda: item.currency,
                saldoDisponible: this.formatCurrency(item.availableBalance),
                saldoContable: this.formatCurrency(item.accountBalance)
            }));
        } catch (error: any) {
            const errorMsg = `Error al obtener saldos de Galicia: ${error.message}`;
            logError(errorMsg, { error: String(error) });
            recordError('GALICIA_SALDOS_ERROR', errorMsg, { error: String(error) });
            
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

    async getMovimientos(): Promise<GaliciaMovimiento[]> {
        try {
            if (!await this.authenticate()) {
                throw new Error('No se pudo autenticar con Galicia');
            }

            const response = await this.client!.get('/api/v1/accounts/transactions');
            
            logInfo('Movimientos obtenidos de Galicia', { count: response.data.length });
            
            return response.data.map((item: any) => ({
                fecha: item.date,
                descripcion: item.description,
                importe: this.formatCurrency(item.amount),
                saldo: this.formatCurrency(item.balance)
            }));
        } catch (error: any) {
            const errorMsg = `Error al obtener movimientos de Galicia: ${error.message}`;
            logError(errorMsg, { error: String(error) });
            recordError('GALICIA_MOVIMIENTOS_ERROR', errorMsg, { error: String(error) });
            
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

    async crearCobranza(data: { cliente: string; monto: number; vencimiento: string }): Promise<string> {
        try {
            if (!await this.authenticate()) {
                throw new Error('No se pudo autenticar con Galicia');
            }

            const response = await this.client!.post('/api/v1/collections', {
                customerName: data.cliente,
                amount: data.monto,
                dueDate: data.vencimiento,
                description: `Cobranza para ${data.cliente}`
            });
            
            logSuccess('Cobranza creada en Galicia', { 
                id: response.data.id,
                cliente: data.cliente,
                monto: data.monto 
            });
            
            return response.data.id;
        } catch (error: any) {
            const errorMsg = `Error al crear cobranza en Galicia: ${error.message}`;
            logError(errorMsg, { error: String(error), data });
            recordError('GALICIA_COBRANZA_ERROR', errorMsg, { error: String(error), data });
            
            // En modo sandbox, devolver ID simulado
            if (this.getConfig().environment === 'sandbox') {
                return `SIM-${Date.now()}`;
            }
            
            throw error;
        }
    }

    async getCobros(): Promise<GaliciaCobranza[]> {
        try {
            if (!await this.authenticate()) {
                throw new Error('No se pudo autenticar con Galicia');
            }

            const response = await this.client!.get('/api/v1/collections');
            
            logInfo('Cobranzas obtenidas de Galicia', { count: response.data.length });
            
            return response.data.map((item: any) => ({
                id: item.id,
                cliente: item.customerName,
                monto: this.formatCurrency(item.amount),
                estado: this.mapEstado(item.status),
                fechaCreacion: item.createdAt,
                fechaVencimiento: item.dueDate
            }));
        } catch (error: any) {
            const errorMsg = `Error al obtener cobranzas de Galicia: ${error.message}`;
            logError(errorMsg, { error: String(error) });
            recordError('GALICIA_COBROS_ERROR', errorMsg, { error: String(error) });
            
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

    async testConnection(): Promise<{ success: boolean; message: string }> {
        try {
            const config = this.getConfig();
            
            if (!config.appId || !config.appKey) {
                return {
                    success: false,
                    message: 'AppID y AppKey son requeridos'
                };
            }

            if (config.certPath && !fs.existsSync(config.certPath)) {
                return {
                    success: false,
                    message: `Certificado no encontrado en: ${config.certPath}`
                };
            }

            if (config.keyPath && !fs.existsSync(config.keyPath)) {
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
        } catch (error: any) {
            return {
                success: false,
                message: `Error de conexión: ${error.message}`
            };
        }
    }

    private formatCurrency(amount: number): string {
        return new Intl.NumberFormat('es-AR', {
            style: 'currency',
            currency: 'ARS'
        }).format(amount);
    }

    private mapEstado(status: string): 'pendiente' | 'pagada' | 'vencida' {
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

export const galiciaService = new GaliciaService();

// Funciones exportadas para IPC
export async function getGaliciaSaldos() {
    return await galiciaService.getSaldos();
}

export async function getGaliciaMovimientos() {
    return await galiciaService.getMovimientos();
}

export async function crearGaliciaCobranza(data: { cliente: string; monto: number; vencimiento: string }) {
    return await galiciaService.crearCobranza(data);
}

export async function getGaliciaCobros() {
    return await galiciaService.getCobros();
}

export async function testGaliciaConnection() {
    return await galiciaService.testConnection();
}
