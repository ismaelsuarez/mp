import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';
import { RemoteConfig, RustDeskProcess } from './types';

export class RustDeskManager {
  private hostProcess: ChildProcess | null = null;
  private viewerProcess: ChildProcess | null = null;
  private processes: Map<number, RustDeskProcess> = new Map();

  async startHost(config: RemoteConfig): Promise<boolean> {
    if (!config.username || !config.password) {
      throw new Error('Usuario y contraseña requeridos para Host');
    }

    const rustdeskPath = path.join(app.getAppPath(), 'resources', 'rustdesk', 'rustdesk.exe');
    
    this.hostProcess = spawn(rustdeskPath, [
      '--server', config.idServer,
      '--relay-server', config.relayServer,
      '--username', config.username,
      '--password', config.password,
      '--host'
    ], { 
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

      return true;
    }

    return false;
  }

  async startViewer(config: RemoteConfig, hostId: string): Promise<boolean> {
    const rustdeskPath = path.join(app.getAppPath(), 'resources', 'rustdesk', 'rustdesk.exe');
    
    this.viewerProcess = spawn(rustdeskPath, [
      '--server', config.idServer,
      '--relay-server', config.relayServer,
      '--connect', hostId,
      '--username', config.username || '',
      '--password', config.password || ''
    ], {
      detached: false,
      stdio: 'pipe'
    });

    if (this.viewerProcess.pid) {
      this.processes.set(this.viewerProcess.pid, {
        pid: this.viewerProcess.pid,
        type: 'viewer',
        startTime: new Date().toISOString(),
        config
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

      // Capturar output para debugging
      this.viewerProcess.stdout?.on('data', (data) => {
        console.log('RustDesk Viewer stdout:', data.toString());
      });

      this.viewerProcess.stderr?.on('data', (data) => {
        console.error('RustDesk Viewer stderr:', data.toString());
      });

      return true;
    }

    return false;
  }

  stopHost(): void {
    if (this.hostProcess) {
      this.hostProcess.kill();
      this.processes.delete(this.hostProcess.pid || 0);
      this.hostProcess = null;
    }
  }

  stopViewer(): void {
    if (this.viewerProcess) {
      this.viewerProcess.kill();
      this.processes.delete(this.viewerProcess.pid || 0);
      this.viewerProcess = null;
    }
  }

  stopAll(): void {
    this.stopHost();
    this.stopViewer();
  }

  getActiveProcesses(): RustDeskProcess[] {
    return Array.from(this.processes.values());
  }

  isHostRunning(): boolean {
    return this.hostProcess !== null && this.hostProcess.pid !== undefined;
  }

  isViewerRunning(): boolean {
    return this.viewerProcess !== null && this.viewerProcess.pid !== undefined;
  }
}
