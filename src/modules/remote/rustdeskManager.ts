import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import fs from 'fs';
import { RemoteConfig, RustDeskProcess } from './types';

export class RustDeskManager {
  private hostProcess: ChildProcess | null = null;
  private viewerProcess: ChildProcess | null = null;
  private processes: Map<number, RustDeskProcess> = new Map();

  // Función para obtener la ruta correcta del binario
  private getRustDeskPath(): string | null {
    // Intentar diferentes ubicaciones posibles
    const possiblePaths = [
      // En desarrollo (desde el directorio del proyecto)
      path.join(process.cwd(), 'resources', 'rustdesk', 'rustdesk.exe'),
      path.join(process.cwd(), 'rustdesk', 'rustdesk.exe'),
      path.join(process.cwd(), 'bin', 'rustdesk.exe'),
      // En producción (desde resources)
      path.join(process.resourcesPath, 'resources', 'rustdesk', 'rustdesk.exe'),
      path.join(process.resourcesPath, 'rustdesk', 'rustdesk.exe'),
      // En el PATH del sistema
      'rustdesk.exe'
    ];

    for (const rustdeskPath of possiblePaths) {
      try {
        if (fs.existsSync(rustdeskPath)) {
          console.log(`✅ Binario RustDesk encontrado en: ${rustdeskPath}`);
          return rustdeskPath;
        }
      } catch (error) {
        console.warn(`⚠️ Error verificando ruta: ${rustdeskPath}`, error);
      }
    }

    console.error('❌ Binario RustDesk no encontrado en ninguna ubicación');
    console.log('📋 Ubicaciones verificadas:');
    possiblePaths.forEach(p => console.log(`   - ${p}`));
    return null;
  }

  async startHost(config: RemoteConfig): Promise<boolean> {
    try {
      if (!config.username || !config.password) {
        throw new Error('Usuario y contraseña requeridos para Host');
      }

      const rustdeskPath = this.getRustDeskPath();
      if (!rustdeskPath) {
        throw new Error('Binario RustDesk no encontrado. Por favor, instale RustDesk o coloque el archivo rustdesk.exe en la carpeta resources/rustdesk/');
      }

      console.log('Ejecutando RustDesk Host desde:', rustdeskPath);

      // CORRECCIÓN: Parámetros correctos para modo host
      const args = [
        '--id', config.idServer,
        '--relay-server', config.relayServer,
        '--username', config.username,
        '--password', config.password,
        '--service'
      ];

      console.log('Parámetros Host:', args);

      this.hostProcess = spawn(rustdeskPath, args, { 
        detached: true,
        stdio: 'ignore'
      });

      if (this.hostProcess.pid) {
        this.processes.set(this.hostProcess.pid, {
          pid: this.hostProcess.pid,
          type: 'host',
          startTime: new Date().toISOString(),
          config
        });

        // Manejar eventos del proceso
        this.hostProcess.on('error', (error) => {
          console.error('Error en proceso Host RustDesk:', error);
          this.processes.delete(this.hostProcess?.pid || 0);
        });

        this.hostProcess.on('exit', (code) => {
          console.log('Proceso Host RustDesk terminado con código:', code);
          this.processes.delete(this.hostProcess?.pid || 0);
          this.hostProcess = null;
        });

        console.log(`Host iniciado con PID: ${this.hostProcess.pid}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error en startHost:', error);
      return false;
    }
  }

  async startViewer(config: RemoteConfig, hostId: string): Promise<boolean> {
    try {
      const rustdeskPath = this.getRustDeskPath();
      if (!rustdeskPath) {
        throw new Error('Binario RustDesk no encontrado. Por favor, instale RustDesk o coloque el archivo rustdesk.exe en la carpeta resources/rustdesk/');
      }

      console.log('Ejecutando RustDesk Viewer desde:', rustdeskPath);

      // CORRECCIÓN: Parámetros para viewer
      const args = [
        '--id', config.idServer,
        '--relay-server', config.relayServer,
        '--connect', hostId
      ];

      console.log('Conectando a host:', hostId, 'con args:', args);

      this.viewerProcess = spawn(rustdeskPath, args, {
        detached: false,
        stdio: 'pipe'
      });

      if (this.viewerProcess.pid) {
        this.processes.set(this.viewerProcess.pid, {
          pid: this.viewerProcess.pid,
          type: 'viewer',
          startTime: new Date().toISOString(),
          config: config
        });

        // Manejar eventos del proceso
        this.viewerProcess.on('error', (error) => {
          console.error('Error en proceso Viewer RustDesk:', error);
          this.processes.delete(this.viewerProcess?.pid || 0);
        });

        this.viewerProcess.on('exit', (code) => {
          console.log('Proceso Viewer RustDesk terminado con código:', code);
          this.processes.delete(this.viewerProcess?.pid || 0);
          this.viewerProcess = null;
        });

        console.log(`Viewer iniciado con PID: ${this.viewerProcess.pid}`);
        return true;
      }

      return false;
    } catch (error) {
      console.error('Error en startViewer:', error);
      return false;
    }
  }

  stopHost(): void {
    if (this.hostProcess) {
      console.log('Deteniendo proceso Host...');
      try {
        this.hostProcess.kill();
        this.processes.delete(this.hostProcess.pid || 0);
      } catch (error) {
        console.error('Error deteniendo Host:', error);
      }
      this.hostProcess = null;
    }
  }

  stopViewer(): void {
    if (this.viewerProcess) {
      console.log('Deteniendo proceso Viewer...');
      try {
        this.viewerProcess.kill();
        this.processes.delete(this.viewerProcess.pid || 0);
      } catch (error) {
        console.error('Error deteniendo Viewer:', error);
      }
      this.viewerProcess = null;
    }
  }

  // NUEVO: Detener todos los procesos
  stopAll(): void {
    console.log('Deteniendo todos los procesos RustDesk...');
    this.stopHost();
    this.stopViewer();
    
    // Limpiar procesos restantes
    for (const [pid, processInfo] of this.processes.entries()) {
      try {
        // Intentar matar el proceso por PID
        const { exec } = require('child_process');
        exec(`taskkill /PID ${pid} /F`, (error: any) => {
          if (error) {
            console.error(`Error deteniendo proceso ${pid}:`, error);
          }
        });
      } catch (error) {
        console.error(`Error deteniendo proceso ${pid}:`, error);
      }
    }
    this.processes.clear();
  }

  // NUEVO: Verificar si procesos están ejecutándose
  isHostRunning(): boolean {
    return this.hostProcess !== null && !this.hostProcess.killed;
  }

  isViewerRunning(): boolean {
    return this.viewerProcess !== null && !this.viewerProcess.killed;
  }

  // NUEVO: Obtener procesos activos (versión segura para IPC)
  getActiveProcesses(): any[] {
    return Array.from(this.processes.values()).map(process => ({
      pid: process.pid,
      type: process.type,
      startTime: process.startTime,
      // No incluir config para evitar problemas de serialización
      config: {
        idServer: process.config.idServer || '',
        relayServer: process.config.relayServer || '',
        role: process.config.role || 'host',
        autoStart: process.config.autoStart || false
        // No incluir username/password por seguridad
      }
    }));
  }

  // NUEVO: Verificar si el binario existe
  static checkBinaryExists(): boolean {
    try {
      const manager = new RustDeskManager();
      const rustdeskPath = (manager as any).getRustDeskPath();
      return rustdeskPath !== null;
    } catch (error) {
      console.error('Error verificando binario RustDesk:', error);
      return false;
    }
  }
}
