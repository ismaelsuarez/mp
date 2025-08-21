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
      }
    } catch (error) {
      console.error('Error cargando configuración remota:', error);
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

  async startHost(): Promise<boolean> {
    try {
      if (!this.config || this.config.role !== 'host') {
        throw new Error('Configuración de Host requerida');
      }

      // Desencriptar credenciales
      const configWithDecrypted = {
        ...this.config,
        username: this.config.username ? this.decrypt(this.config.username) : '',
        password: this.config.password ? this.decrypt(this.config.password) : ''
      };

      const success = await this.rustDeskManager.startHost(configWithDecrypted);
      
      if (success && this.serverSync && this.hostId) {
        // Registrar en servidor VPS
        const hostname = os.hostname();
        await this.serverSync.registerHost(this.hostId, hostname);
        console.log(`Host iniciado y registrado con ID: ${this.hostId}`);
      }

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

  getConfig(): RemoteConfig | null {
    return this.config;
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
    try {
      if (!this.serverSync) {
        return false;
      }
      return await this.serverSync.pingServer();
    } catch (error) {
      console.error('Error haciendo ping al servidor:', error);
      return false;
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
      const algorithm = 'aes-256-cbc';
      const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
      const parts = encryptedText.split(':');
      
      if (parts.length !== 2) {
        // Si no está encriptado, retornar tal como está
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
      return encryptedText; // Fallback: retornar texto tal como está
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
