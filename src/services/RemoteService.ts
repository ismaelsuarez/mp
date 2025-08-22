import { getDb } from './DbService';
import { RustDeskManager } from '../modules/remote/rustdeskManager';
import { ServerSync } from '../modules/remote/serverSync';
import { RemoteConfig, RemoteHost, RemoteRole } from '../modules/remote/types';
import crypto from 'crypto';
import os from 'os';

export class RemoteService {
  private rustDeskManager: RustDeskManager;
  private serverSync: ServerSync | null = null;
  private config: RemoteConfig | null = null;
  private hostId: string | null = null;

  // Función de debug para mejor trazabilidad
  private debug(message: string, data?: any): void {
    if (process.env.DEBUG === 'true') {
      console.log(`[RemoteService] ${message}`, data || '');
    }
  }

  constructor() {
    this.rustDeskManager = new RustDeskManager();
    this.loadConfig();
    this.generateHostId();
  }

  private loadConfig(): void {
    try {
      const db = getDb();
      const config = db.getRemoteConfig();
      if (config) {
        this.config = config;
        this.serverSync = new ServerSync(config.idServer, config.relayServer);
        this.debug('Configuración remota cargada', { 
          idServer: config.idServer, 
          relayServer: config.relayServer, 
          role: config.role 
        });
        
        // Auto-start solo si la configuración es válida y está habilitada
        if (config.autoStart && config.role === 'host' && config.username && config.password) {
          this.debug('Auto-start habilitado, iniciando host en 1 segundo...');
          // Iniciar de forma asíncrona para no bloquear el constructor
          setTimeout(async () => {
            try {
              await this.startHost();
            } catch (error) {
              console.warn('Auto-start del control remoto falló:', error);
            }
          }, 1000);
        } else {
          this.debug('Auto-start no habilitado o configuración incompleta', {
            autoStart: config.autoStart,
            role: config.role,
            hasUsername: !!config.username,
            hasPassword: !!config.password
          });
        }
      } else {
        // Si no hay configuración guardada, usar valores por defecto del .env
        const defaultConfig = this.getDefaultConfig();
        this.config = defaultConfig;
        this.serverSync = new ServerSync(defaultConfig.idServer, defaultConfig.relayServer);
        this.debug('Usando configuración por defecto del .env', { 
          idServer: defaultConfig.idServer, 
          relayServer: defaultConfig.relayServer 
        });
      }
    } catch (error) {
      console.error('Error cargando configuración remota:', error);
      // En caso de error, usar configuración por defecto
      const defaultConfig = this.getDefaultConfig();
      this.config = defaultConfig;
      this.serverSync = new ServerSync(defaultConfig.idServer, defaultConfig.relayServer);
    }
  }

  private generateHostId(): void {
    // Generar un ID único basado en el hostname y MAC address
    const hostname = os.hostname();
    const networkInterfaces = os.networkInterfaces();
    let macAddress = '';
    
    // Obtener la primera MAC address disponible
    for (const interfaceName in networkInterfaces) {
      const interfaces = networkInterfaces[interfaceName];
      if (interfaces) {
        for (const iface of interfaces) {
          if (iface.mac && iface.mac !== '00:00:00:00:00:00') {
            macAddress = iface.mac;
            break;
          }
        }
        if (macAddress) break;
      }
    }

    // Crear un hash único del hostname + MAC
    const uniqueString = `${hostname}-${macAddress}`;
    this.hostId = crypto.createHash('md5').update(uniqueString).digest('hex').substring(0, 8);
  }

  async saveConfig(config: RemoteConfig): Promise<boolean> {
    try {
      // Validar configuración
      if (!config.idServer || !config.relayServer) {
        throw new Error('Servidores ID y Relay son requeridos');
      }

      if (config.role === 'host' && (!config.username || !config.password)) {
        throw new Error('Usuario y contraseña son requeridos para modo Host');
      }

      // Encriptar credenciales si están presentes
      const configToSave = { ...config };
      if (configToSave.username) {
        configToSave.username = this.encrypt(configToSave.username);
      }
      if (configToSave.password) {
        configToSave.password = this.encrypt(configToSave.password);
      }

      // Guardar en base de datos
      const db = getDb();
      db.saveRemoteConfig(configToSave);
      
      // Actualizar configuración local
      this.config = configToSave;
      this.serverSync = new ServerSync(configToSave.idServer, configToSave.relayServer);

      // Auto-start si está configurado
      if (configToSave.autoStart && configToSave.role === 'host') {
        await this.startHost();
      }

      console.log('Configuración remota guardada exitosamente');
      return true;
    } catch (error) {
      console.error('Error guardando configuración remota:', error);
      return false;
    }
  }

  // Método para obtener configuración por defecto desde variables de entorno
  getDefaultConfig(): RemoteConfig {
    return {
      role: 'host',
      idServer: process.env.REMOTE_ID_SERVER || '149.50.150.15:21115',
      relayServer: process.env.REMOTE_RELAY_SERVER || '149.50.150.15:21116',
      username: '',
      password: '',
      autoStart: false
    };
  }

  async startHost(): Promise<boolean> {
    this.debug('Iniciando host...');
    try {
      if (!this.config) {
        throw new Error('Configuración de control remoto no encontrada');
      }
      
      if (this.config.role !== 'host') {
        throw new Error('Configuración no es para modo Host');
      }

      if (!this.config.username || !this.config.password) {
        throw new Error('Usuario y contraseña son requeridos para modo Host');
      }

      // Desencriptar credenciales
      const configWithDecrypted = {
        ...this.config,
        username: this.decrypt(this.config.username),
        password: this.decrypt(this.config.password)
      };

      this.debug('Iniciando host con configuración', { idServer: configWithDecrypted.idServer, relayServer: configWithDecrypted.relayServer });
      const success = await this.rustDeskManager.startHost(configWithDecrypted);
      
      if (success && this.serverSync && this.hostId) {
        // Registrar en servidor VPS
        const hostname = os.hostname();
        await this.serverSync.registerHost(this.hostId, hostname);
        this.debug(`Host iniciado y registrado con ID: ${this.hostId}`);
        console.log(`Host iniciado y registrado con ID: ${this.hostId}`);
      }

      this.debug('Resultado de inicio de host:', success);
      return success;
    } catch (error) {
      console.error('Error iniciando Host:', error);
      return false;
    }
  }

  async startViewer(hostId: string): Promise<boolean> {
    try {
      if (!this.config || this.config.role !== 'viewer') {
        throw new Error('Configuración de Viewer requerida');
      }

      // Desencriptar credenciales si están presentes
      const configWithDecrypted = {
        ...this.config,
        username: this.config.username ? this.decrypt(this.config.username) : '',
        password: this.config.password ? this.decrypt(this.config.password) : ''
      };

      const success = await this.rustDeskManager.startViewer(configWithDecrypted, hostId);
      
      if (success) {
        console.log(`Viewer iniciado para conectar a: ${hostId}`);
      }

      return success;
    } catch (error) {
      console.error('Error iniciando Viewer:', error);
      return false;
    }
  }

  async getOnlineHosts(): Promise<RemoteHost[]> {
    try {
      if (!this.serverSync) {
        console.warn('Servidor no configurado');
        return [];
      }

      const hosts = await this.serverSync.getOnlineHosts();
      console.log(`Obtenidos ${hosts.length} hosts online`);
      return hosts;
    } catch (error) {
      console.error('Error obteniendo hosts online:', error);
      return [];
    }
  }

  async stopHost(): Promise<void> {
    try {
      this.rustDeskManager.stopHost();
      console.log('Host detenido');
    } catch (error) {
      console.error('Error deteniendo Host:', error);
    }
  }

  async stopViewer(): Promise<void> {
    try {
      this.rustDeskManager.stopViewer();
      console.log('Viewer detenido');
    } catch (error) {
      console.error('Error deteniendo Viewer:', error);
    }
  }

  async stopAll(): Promise<void> {
    try {
      this.rustDeskManager.stopAll();
      console.log('Todos los procesos RustDesk detenidos');
    } catch (error) {
      console.error('Error deteniendo procesos:', error);
    }
  }

  async getConfig(): Promise<RemoteConfig | null> {
    try {
      const db = getDb();
      const config = db.getRemoteConfig();
      
      if (config) {
        // Desencriptar credenciales para la UI
        const decryptedConfig = { ...config };
        if (decryptedConfig.username) {
          decryptedConfig.username = this.decrypt(decryptedConfig.username);
        }
        if (decryptedConfig.password) {
          decryptedConfig.password = this.decrypt(decryptedConfig.password);
        }
        return decryptedConfig;
      }
      
      // Si no hay configuración guardada, retornar configuración por defecto del .env
      console.log('No hay configuración guardada, usando valores por defecto del .env');
      return this.getDefaultConfig();
    } catch (error) {
      console.error('Error obteniendo configuración:', error);
      // En caso de error, retornar configuración por defecto
      return this.getDefaultConfig();
    }
  }

  getHostId(): string | null {
    return this.hostId;
  }

  isHostRunning(): boolean {
    return this.rustDeskManager.isHostRunning();
  }

  isViewerRunning(): boolean {
    return this.rustDeskManager.isViewerRunning();
  }

  getActiveProcesses() {
    return this.rustDeskManager.getActiveProcesses();
  }

  async pingServer(): Promise<boolean> {
    if (!this.config) return false;
    
    try {
      // Intentar hacer ping al servidor ID con timeout manual
      const controller = new AbortController();
      const timeoutId = setTimeout(() => controller.abort(), 5000);
      
      const response = await fetch(`http://${this.config.idServer}/api/status`, {
        method: 'GET',
        signal: controller.signal
      });
      
      clearTimeout(timeoutId);
      return response.ok;
    } catch (error) {
      console.error('Error pingeando servidor:', error);
      return false;
    }
  }

  async getStatus(): Promise<any> {
    try {
      const config = await this.getConfig();
      const hosts = await this.getOnlineHosts();
      const serverOnline = await this.pingServer();
      
      // Crear un objeto completamente seguro y serializable
      const status = {
        config: config ? {
          idServer: config.idServer || '',
          relayServer: config.relayServer || '',
          username: config.username || '',
          password: config.password || '',
          role: config.role || 'host',
          autoStart: config.autoStart || false
        } : null,
        serverOnline: Boolean(serverOnline),
        hostsCount: Array.isArray(hosts) ? hosts.length : 0,
        hostRunning: Boolean(this.rustDeskManager.isHostRunning()),
        viewerRunning: Boolean(this.rustDeskManager.isViewerRunning()),
        activeProcesses: this.rustDeskManager.getActiveProcesses() || [],
        hostId: this.hostId || null
      };
      
      this.debug('Estado obtenido', status);
      return status;
    } catch (error) {
      console.error('Error obteniendo estado:', error);
      // Retornar un objeto seguro en caso de error
      return {
        config: null,
        serverOnline: false,
        hostsCount: 0,
        hostRunning: false,
        viewerRunning: false,
        activeProcesses: [],
        hostId: null
      };
    }
  }

  private encrypt(text: string): string {
    try {
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
      const iv = crypto.randomBytes(16);
      const cipher = crypto.createCipheriv(algorithm, key, iv);
      let encrypted = cipher.update(text, 'utf8', 'hex');
      encrypted += cipher.final('hex');
      return iv.toString('hex') + ':' + encrypted;
    } catch (error) {
      console.error('Error encriptando texto:', error);
      return text; // Fallback: retornar texto sin encriptar
    }
  }

  private decrypt(encryptedText: string): string {
    try {
      // Si el texto no está encriptado (no tiene formato iv:encrypted), retornarlo tal como está
      if (!encryptedText || !encryptedText.includes(':')) {
        return encryptedText;
      }

      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
      const parts = encryptedText.split(':');
      
      if (parts.length !== 2) {
        // Si no está encriptado correctamente, retornar tal como está
        return encryptedText;
      }
      
      const iv = Buffer.from(parts[0], 'hex');
      const encrypted = parts[1];
      const decipher = crypto.createDecipheriv(algorithm, key, iv);
      let decrypted = decipher.update(encrypted, 'hex', 'utf8');
      decrypted += decipher.final('utf8');
      return decrypted;
    } catch (error) {
      console.error('Error desencriptando texto:', error);
      // En caso de error de desencriptación, limpiar la configuración corrupta
      console.warn('Credenciales corruptas detectadas. Limpiando configuración...');
      this.clearCorruptedConfig();
      return ''; // Retornar string vacío para forzar nueva configuración
    }
  }

  // Método para limpiar configuración corrupta
  private clearCorruptedConfig(): void {
    try {
      const db = getDb();
      // Limpiar configuración remota corrupta usando valores por defecto del .env
      const defaultConfig = this.getDefaultConfig();
      db.saveRemoteConfig(defaultConfig);
      this.config = defaultConfig;
      this.serverSync = new ServerSync(defaultConfig.idServer, defaultConfig.relayServer);
      console.log('✅ Configuración corrupta limpiada. Usando valores por defecto del .env.');
    } catch (error) {
      console.error('Error limpiando configuración corrupta:', error);
    }
  }
}

let remoteServiceInstance: RemoteService | null = null;

export function getRemoteService(): RemoteService {
  if (!remoteServiceInstance) {
    remoteServiceInstance = new RemoteService();
  }
  return remoteServiceInstance;
}
