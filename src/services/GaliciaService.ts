import { app } from 'electron';
import fs from 'fs';
import path from 'path';
import Store from 'electron-store';
import { recordError } from './ErrorNotificationService';
import { logError, logInfo, logSuccess } from './LogService';
import axios, { AxiosInstance, AxiosResponse } from 'axios';

// Interfaces para tipos de datos
interface GaliciaConfig {
	GALICIA_APP_ID: string;
	GALICIA_APP_KEY: string;
	GALICIA_CERT_PATH: string;
	GALICIA_KEY_PATH: string;
	GALICIA_ENVIRONMENT: 'sandbox' | 'production';
}

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
	monto: number;
	vencimiento: string;
	estado: 'pendiente' | 'pagada' | 'vencida';
}

interface GaliciaAuthResponse {
	access_token: string;
	token_type: string;
	expires_in: number;
}

class GaliciaService {
	private client: AxiosInstance | null = null;
	private accessToken: string | null = null;
	private tokenExpiry: number = 0;
	private store: Store;

	constructor() {
		this.store = new Store();
	}

	private getConfig(): GaliciaConfig {
		const cfg: any = this.store.get('config') || {};
		return {
			GALICIA_APP_ID: cfg.GALICIA_APP_ID || '',
			GALICIA_APP_KEY: cfg.GALICIA_APP_KEY || '',
			GALICIA_CERT_PATH: cfg.GALICIA_CERT_PATH || '',
			GALICIA_KEY_PATH: cfg.GALICIA_KEY_PATH || '',
			GALICIA_ENVIRONMENT: cfg.GALICIA_ENVIRONMENT || 'sandbox'
		};
	}

	private getBaseUrl(): string {
		const config = this.getConfig();
		return config.GALICIA_ENVIRONMENT === 'production' 
			? 'https://api.galicia.com.ar' 
			: 'https://api-sandbox.galicia.com.ar';
	}

	private async authenticate(): Promise<boolean> {
		try {
			const config = this.getConfig();
			
			if (!config.GALICIA_APP_ID || !config.GALICIA_APP_KEY) {
				throw new Error('Faltan credenciales de Galicia (AppID o AppKey)');
			}

			// Verificar si el token actual es válido
			if (this.accessToken && Date.now() < this.tokenExpiry) {
				return true;
			}

			// Leer certificados
			let cert: string, key: string;
			try {
				cert = fs.readFileSync(config.GALICIA_CERT_PATH, 'utf8');
				key = fs.readFileSync(config.GALICIA_KEY_PATH, 'utf8');
			} catch (error) {
				throw new Error(`Error al leer certificados: ${error}`);
			}

			// Crear cliente HTTPS con certificados
			this.client = axios.create({
				baseURL: this.getBaseUrl(),
				httpsAgent: {
					cert,
					key,
					passphrase: config.GALICIA_APP_KEY
				},
				timeout: 30000
			});

			// Autenticación OAuth2
			const authResponse: AxiosResponse<GaliciaAuthResponse> = await this.client.post('/oauth/token', {
				grant_type: 'client_credentials',
				client_id: config.GALICIA_APP_ID,
				client_secret: config.GALICIA_APP_KEY
			});

			this.accessToken = authResponse.data.access_token;
			this.tokenExpiry = Date.now() + (authResponse.data.expires_in * 1000);

			// Configurar interceptor para incluir token en todas las requests
			this.client.interceptors.request.use((config) => {
				if (this.accessToken) {
					config.headers.Authorization = `Bearer ${this.accessToken}`;
				}
				return config;
			});

			logSuccess('Galicia', 'Autenticación exitosa');
			return true;

		} catch (error) {
			const errorMsg = `Error de autenticación Galicia: ${error}`;
			logError('Galicia', errorMsg);
			recordError('GALICIA_AUTH_ERROR', errorMsg);
			return false;
		}
	}

	async getSaldos(): Promise<GaliciaSaldo[]> {
		try {
			const authenticated = await this.authenticate();
			if (!authenticated || !this.client) {
				throw new Error('No se pudo autenticar con Galicia');
			}

			const response = await this.client.get('/api/v1/accounts/balances');
			
			// Transformar respuesta de la API a nuestro formato
			const saldos: GaliciaSaldo[] = response.data.accounts?.map((account: any) => ({
				cuenta: account.accountNumber,
				moneda: account.currency,
				saldoDisponible: this.formatCurrency(account.availableBalance),
				saldoContable: this.formatCurrency(account.bookBalance)
			})) || [];

			logInfo('Galicia', `Saldos obtenidos: ${saldos.length} cuentas`);
			return saldos;

		} catch (error) {
			const errorMsg = `Error al obtener saldos: ${error}`;
			logError('Galicia', errorMsg);
			recordError('GALICIA_SALDOS_ERROR', errorMsg);
			throw error;
		}
	}

	async getMovimientos(): Promise<GaliciaMovimiento[]> {
		try {
			const authenticated = await this.authenticate();
			if (!authenticated || !this.client) {
				throw new Error('No se pudo autenticar con Galicia');
			}

			// Obtener movimientos de los últimos 30 días
			const endDate = new Date();
			const startDate = new Date();
			startDate.setDate(startDate.getDate() - 30);

			const response = await this.client.get('/api/v1/accounts/transactions', {
				params: {
					fromDate: startDate.toISOString().split('T')[0],
					toDate: endDate.toISOString().split('T')[0],
					limit: 100
				}
			});

			// Transformar respuesta de la API a nuestro formato
			const movimientos: GaliciaMovimiento[] = response.data.transactions?.map((txn: any) => ({
				fecha: txn.date,
				descripcion: txn.description,
				importe: this.formatCurrency(txn.amount),
				saldo: this.formatCurrency(txn.balance)
			})) || [];

			logInfo('Galicia', `Movimientos obtenidos: ${movimientos.length} transacciones`);
			return movimientos;

		} catch (error) {
			const errorMsg = `Error al obtener movimientos: ${error}`;
			logError('Galicia', errorMsg);
			recordError('GALICIA_MOVIMIENTOS_ERROR', errorMsg);
			throw error;
		}
	}

	async crearCobranza(data: { cliente: string; monto: number; vencimiento: string }): Promise<string> {
		try {
			const authenticated = await this.authenticate();
			if (!authenticated || !this.client) {
				throw new Error('No se pudo autenticar con Galicia');
			}

			const response = await this.client.post('/api/v1/collections', {
				clientName: data.cliente,
				amount: data.monto,
				dueDate: data.vencimiento,
				description: `Cobranza para ${data.cliente}`,
				currency: 'ARS'
			});

			const cobranzaId = response.data.collectionId;
			logSuccess('Galicia', `Cobranza creada exitosamente: ${cobranzaId}`);
			return cobranzaId;

		} catch (error) {
			const errorMsg = `Error al crear cobranza: ${error}`;
			logError('Galicia', errorMsg);
			recordError('GALICIA_COBRANZA_ERROR', errorMsg);
			throw error;
		}
	}

	async getCobros(): Promise<GaliciaCobranza[]> {
		try {
			const authenticated = await this.authenticate();
			if (!authenticated || !this.client) {
				throw new Error('No se pudo autenticar con Galicia');
			}

			const response = await this.client.get('/api/v1/collections');

			// Transformar respuesta de la API a nuestro formato
			const cobranzas: GaliciaCobranza[] = response.data.collections?.map((col: any) => ({
				id: col.collectionId,
				cliente: col.clientName,
				monto: col.amount,
				vencimiento: col.dueDate,
				estado: this.mapEstado(col.status)
			})) || [];

			logInfo('Galicia', `Cobranzas obtenidas: ${cobranzas.length} registros`);
			return cobranzas;

		} catch (error) {
			const errorMsg = `Error al obtener cobranzas: ${error}`;
			logError('Galicia', errorMsg);
			recordError('GALICIA_COBROS_ERROR', errorMsg);
			throw error;
		}
	}

	async testConnection(): Promise<{ success: boolean; message: string }> {
		try {
			const authenticated = await this.authenticate();
			if (!authenticated) {
				return { success: false, message: 'Error de autenticación' };
			}

			// Probar con una consulta simple
			await this.getSaldos();
			return { success: true, message: 'Conexión exitosa con Banco Galicia' };

		} catch (error) {
			return { 
				success: false, 
				message: `Error de conexión: ${error}` 
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

// Instancia singleton
export const galiciaService = new GaliciaService();

// Funciones de exportación para compatibilidad con el patrón existente
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
