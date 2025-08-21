# PLAN DE IMPLEMENTACIÓN - MÓDULO DE CONTROL REMOTO RUSTDESK

## 1. ARQUITECTURA DEL MÓDULO

### 1.1 Estructura de Archivos
```
src/
├── modules/
│   └── remote/
│       ├── types.ts              # Tipos para control remoto
│       ├── remoteService.ts      # Servicio principal
│       ├── rustdeskManager.ts    # Gestión de binarios RustDesk
│       └── serverSync.ts         # Sincronización con servidor VPS
├── services/
│   └── RemoteService.ts          # Servicio de alto nivel
└── resources/
    └── rustdesk/
        └── rustdesk.exe          # Binario principal RustDesk
```

### 1.2 Dependencias Principales
- **child_process**: Ejecución de binarios RustDesk
- **electron-store**: Persistencia de configuración
- **node-fetch**: Consultas al servidor VPS
- **crypto**: Encriptación de credenciales

## 2. IMPLEMENTACIÓN POR FASES

### FASE 1: Estructura Base y Tipos

#### 2.1 Definición de Tipos (`src/modules/remote/types.ts`)
```typescript
export type RemoteRole = 'host' | 'viewer';

export interface RemoteConfig {
  role: RemoteRole;
  idServer: string;
  relayServer: string;
  username?: string;
  password?: string;
  autoStart: boolean;
}

export interface RemoteHost {
  id: string;
  name: string;
  status: 'online' | 'offline';
  lastSeen: string;
  location?: string;
}

export interface RemoteConnection {
  hostId: string;
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
  startTime?: string;
  endTime?: string;
}
```

#### 2.2 Servicio de Gestión RustDesk (`src/modules/remote/rustdeskManager.ts`)
```typescript
import { spawn, ChildProcess } from 'child_process';
import path from 'path';
import { app } from 'electron';

export class RustDeskManager {
  private hostProcess: ChildProcess | null = null;
  private viewerProcess: ChildProcess | null = null;

  async startHost(config: RemoteConfig): Promise<boolean> {
    if (!config.username || !config.password) {
      throw new Error('Usuario y contraseña requeridos para Host');
    }

    const hostPath = path.join(app.getAppPath(), 'resources', 'rustdesk', 'rustdesk-host.exe');
    
    this.hostProcess = spawn(hostPath, [
      '--id-server', config.idServer,
      '--relay-server', config.relayServer,
      '--username', config.username,
      '--password', config.password
    ], { 
      detached: true,
      stdio: 'ignore'
    });

    return this.hostProcess.pid !== undefined;
  }

  async startViewer(config: RemoteConfig, hostId: string): Promise<boolean> {
    const viewerPath = path.join(app.getAppPath(), 'resources', 'rustdesk', 'rustdesk-viewer.exe');
    
    this.viewerProcess = spawn(viewerPath, [
      '--id-server', config.idServer,
      '--relay-server', config.relayServer,
      '--connect', hostId,
      '--username', config.username || '',
      '--password', config.password || ''
    ], {
      detached: false,
      stdio: 'pipe'
    });

    return this.viewerProcess.pid !== undefined;
  }

  stopHost(): void {
    if (this.hostProcess) {
      this.hostProcess.kill();
      this.hostProcess = null;
    }
  }

  stopViewer(): void {
    if (this.viewerProcess) {
      this.viewerProcess.kill();
      this.viewerProcess = null;
    }
  }
}
```

### FASE 2: Sincronización con Servidor VPS

#### 2.3 Servicio de Sincronización (`src/modules/remote/serverSync.ts`)
```typescript
import fetch from 'node-fetch';

export class ServerSync {
  private idServer: string;

  constructor(idServer: string) {
    this.idServer = idServer;
  }

  async getOnlineHosts(): Promise<RemoteHost[]> {
    try {
      const response = await fetch(`http://${this.idServer}/api/online_clients`);
      if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${response.statusText}`);
      }
      
      const data = await response.json();
      return data.clients.map((client: any) => ({
        id: client.id,
        name: client.name || `Host ${client.id}`,
        status: client.online ? 'online' : 'offline',
        lastSeen: client.last_seen,
        location: client.location
      }));
    } catch (error) {
      console.error('Error obteniendo hosts online:', error);
      return [];
    }
  }

  async registerHost(hostId: string, name: string): Promise<boolean> {
    try {
      const response = await fetch(`http://${this.idServer}/api/register`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id: hostId, name })
      });
      
      return response.ok;
    } catch (error) {
      console.error('Error registrando host:', error);
      return false;
    }
  }
}
```

### FASE 3: Servicio Principal

#### 2.4 Servicio de Control Remoto (`src/services/RemoteService.ts`)
```typescript
import { getDb } from './DbService';
import { RustDeskManager } from '../modules/remote/rustdeskManager';
import { ServerSync } from '../modules/remote/serverSync';
import { RemoteConfig, RemoteHost, RemoteRole } from '../modules/remote/types';
import crypto from 'crypto';

export class RemoteService {
  private rustDeskManager: RustDeskManager;
  private serverSync: ServerSync;
  private config: RemoteConfig | null = null;

  constructor() {
    this.rustDeskManager = new RustDeskManager();
    this.loadConfig();
  }

  private loadConfig(): void {
    const db = getDb();
    const config = db.getRemoteConfig();
    if (config) {
      this.config = config;
      this.serverSync = new ServerSync(config.idServer);
    }
  }

  async saveConfig(config: RemoteConfig): Promise<boolean> {
    try {
      // Encriptar credenciales
      if (config.username) {
        config.username = this.encrypt(config.username);
      }
      if (config.password) {
        config.password = this.encrypt(config.password);
      }

      const db = getDb();
      db.saveRemoteConfig(config);
      this.config = config;
      this.serverSync = new ServerSync(config.idServer);

      // Auto-start si está configurado
      if (config.autoStart && config.role === 'host') {
        await this.startHost();
      }

      return true;
    } catch (error) {
      console.error('Error guardando configuración remota:', error);
      return false;
    }
  }

  async startHost(): Promise<boolean> {
    if (!this.config || this.config.role !== 'host') {
      throw new Error('Configuración de Host requerida');
    }

    const success = await this.rustDeskManager.startHost(this.config);
    if (success) {
      // Registrar en servidor VPS
      const hostId = this.generateHostId();
      await this.serverSync.registerHost(hostId, this.getHostName());
    }

    return success;
  }

  async startViewer(hostId: string): Promise<boolean> {
    if (!this.config || this.config.role !== 'viewer') {
      throw new Error('Configuración de Viewer requerida');
    }

    return await this.rustDeskManager.startViewer(this.config, hostId);
  }

  async getOnlineHosts(): Promise<RemoteHost[]> {
    if (!this.serverSync) {
      return [];
    }

    return await this.serverSync.getOnlineHosts();
  }

  async stopHost(): Promise<void> {
    this.rustDeskManager.stopHost();
  }

  async stopViewer(): Promise<void> {
    this.rustDeskManager.stopViewer();
  }

  private encrypt(text: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const iv = crypto.randomBytes(16);
    const cipher = crypto.createCipher(algorithm, key);
    let encrypted = cipher.update(text, 'utf8', 'hex');
    encrypted += cipher.final('hex');
    return iv.toString('hex') + ':' + encrypted;
  }

  private decrypt(encryptedText: string): string {
    const algorithm = 'aes-256-cbc';
    const key = crypto.scryptSync(process.env.ENCRYPTION_KEY || 'default-key', 'salt', 32);
    const parts = encryptedText.split(':');
    const iv = Buffer.from(parts[0], 'hex');
    const encrypted = parts[1];
    const decipher = crypto.createDecipher(algorithm, key);
    let decrypted = decipher.update(encrypted, 'hex', 'utf8');
    decrypted += decipher.final('utf8');
    return decrypted;
  }

  private generateHostId(): string {
    return crypto.randomBytes(8).toString('hex');
  }

  private getHostName(): string {
    return require('os').hostname();
  }
}

let remoteServiceInstance: RemoteService | null = null;

export function getRemoteService(): RemoteService {
  if (!remoteServiceInstance) {
    remoteServiceInstance = new RemoteService();
  }
  return remoteServiceInstance;
}
```

### FASE 4: Integración con IPC

#### 2.5 Actualización de `src/main.ts`
```typescript
// Agregar imports
import { getRemoteService } from './services/RemoteService';

// Agregar handlers IPC
ipcMain.handle('remote:saveConfig', async (_e, config: any) => {
  try {
    const success = await getRemoteService().saveConfig(config);
    return { ok: success };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('remote:startHost', async () => {
  try {
    const success = await getRemoteService().startHost();
    return { ok: success };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('remote:startViewer', async (_e, hostId: string) => {
  try {
    const success = await getRemoteService().startViewer(hostId);
    return { ok: success };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('remote:getOnlineHosts', async () => {
  try {
    const hosts = await getRemoteService().getOnlineHosts();
    return { ok: true, hosts };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('remote:stopHost', async () => {
  try {
    await getRemoteService().stopHost();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
});

ipcMain.handle('remote:stopViewer', async () => {
  try {
    await getRemoteService().stopViewer();
    return { ok: true };
  } catch (e: any) {
    return { ok: false, error: String(e?.message || e) };
  }
});
```

#### 2.6 Actualización de `src/preload.ts`
```typescript
// Agregar a contextBridge.exposeInMainWorld
remote: {
  saveConfig: (config: any) => ipcRenderer.invoke('remote:saveConfig', config),
  startHost: () => ipcRenderer.invoke('remote:startHost'),
  startViewer: (hostId: string) => ipcRenderer.invoke('remote:startViewer', hostId),
  getOnlineHosts: () => ipcRenderer.invoke('remote:getOnlineHosts'),
  stopHost: () => ipcRenderer.invoke('remote:stopHost'),
  stopViewer: () => ipcRenderer.invoke('remote:stopViewer')
}
```

### FASE 5: Interfaz de Usuario

#### 2.7 Actualización de `public/config.html`
```html
<!-- Agregar nueva sección -->
<details id="sec-control-remoto">
  <summary>Control Remoto (RustDesk)</summary>
  
  <div class="config-section">
    <h3>Configuración de Control Remoto</h3>
    
    <div class="form-group">
      <label>Rol del Equipo:</label>
      <select id="remoteRole">
        <option value="host">Host (Puesto)</option>
        <option value="viewer">Viewer (Jefe)</option>
      </select>
    </div>

    <div class="form-group">
      <label>Servidor ID:</label>
      <input type="text" id="remoteIdServer" placeholder="mi-vps.com:21115" />
    </div>

    <div class="form-group">
      <label>Servidor Relay:</label>
      <input type="text" id="remoteRelayServer" placeholder="mi-vps.com:21116" />
    </div>

    <div id="hostConfig" style="display:none;">
      <div class="form-group">
        <label>Usuario Remoto:</label>
        <input type="text" id="remoteUsername" placeholder="puesto1" />
      </div>
      
      <div class="form-group">
        <label>Contraseña Remota:</label>
        <input type="password" id="remotePassword" placeholder="1234" />
      </div>
      
      <div class="form-group">
        <label>
          <input type="checkbox" id="remoteAutoStart" />
          Iniciar automáticamente al arrancar
        </label>
      </div>
      
      <button id="btnSaveHost" class="btn-primary">Guardar y Activar Host</button>
      <button id="btnStopHost" class="btn-secondary">Detener Host</button>
    </div>

    <div id="viewerConfig" style="display:none;">
      <h4>Sucursales Disponibles</h4>
      <button id="btnRefreshHosts" class="btn-secondary">Actualizar Lista</button>
      
      <table id="hostsTable" class="data-table">
        <thead>
          <tr>
            <th>Nombre</th>
            <th>Estado</th>
            <th>Última Conexión</th>
            <th>Acciones</th>
          </tr>
        </thead>
        <tbody id="hostsTableBody">
        </tbody>
      </table>
    </div>
  </div>
</details>
```

#### 2.8 Actualización de `src/renderer.ts`
```typescript
// Agregar funciones para control remoto
async function remoteLoadConfig() {
  try {
    const result = await (window.api as any).remote?.getConfig?.();
    if (result?.ok && result.data) {
      const config = result.data;
      (document.getElementById('remoteRole') as HTMLSelectElement).value = config.role;
      (document.getElementById('remoteIdServer') as HTMLInputElement).value = config.idServer;
      (document.getElementById('remoteRelayServer') as HTMLInputElement).value = config.relayServer;
      
      if (config.role === 'host') {
        (document.getElementById('remoteUsername') as HTMLInputElement).value = config.username || '';
        (document.getElementById('remotePassword') as HTMLInputElement).value = config.password || '';
        (document.getElementById('remoteAutoStart') as HTMLInputElement).checked = config.autoStart;
        showHostConfig();
      } else {
        showViewerConfig();
        await remoteLoadHosts();
      }
    }
  } catch (e: any) {
    showToast('Error cargando configuración remota');
  }
}

function showHostConfig() {
  (document.getElementById('hostConfig') as HTMLElement).style.display = 'block';
  (document.getElementById('viewerConfig') as HTMLElement).style.display = 'none';
}

function showViewerConfig() {
  (document.getElementById('hostConfig') as HTMLElement).style.display = 'none';
  (document.getElementById('viewerConfig') as HTMLElement).style.display = 'block';
}

async function remoteSaveConfig() {
  try {
    const role = (document.getElementById('remoteRole') as HTMLSelectElement).value;
    const config = {
      role,
      idServer: (document.getElementById('remoteIdServer') as HTMLInputElement).value,
      relayServer: (document.getElementById('remoteRelayServer') as HTMLInputElement).value,
      username: role === 'host' ? (document.getElementById('remoteUsername') as HTMLInputElement).value : '',
      password: role === 'host' ? (document.getElementById('remotePassword') as HTMLInputElement).value : '',
      autoStart: role === 'host' ? (document.getElementById('remoteAutoStart') as HTMLInputElement).checked : false
    };

    const result = await (window.api as any).remote?.saveConfig?.(config);
    if (result?.ok) {
      showToast('Configuración guardada');
      if (role === 'host') {
        showHostConfig();
      } else {
        showViewerConfig();
        await remoteLoadHosts();
      }
    } else {
      showToast('Error guardando configuración');
    }
  } catch (e: any) {
    showToast('Error guardando configuración');
  }
}

async function remoteLoadHosts() {
  try {
    const result = await (window.api as any).remote?.getOnlineHosts?.();
    if (result?.ok) {
      const tbody = document.getElementById('hostsTableBody');
      if (tbody) {
        tbody.innerHTML = '';
        result.hosts.forEach((host: any) => {
          const row = document.createElement('tr');
          row.innerHTML = `
            <td>${host.name}</td>
            <td><span class="status-${host.status}">${host.status}</span></td>
            <td>${host.lastSeen}</td>
            <td>
              <button onclick="remoteConnect('${host.id}')" class="btn-small btn-primary" ${host.status === 'offline' ? 'disabled' : ''}>
                Conectar
              </button>
            </td>
          `;
          tbody.appendChild(row);
        });
      }
    }
  } catch (e: any) {
    showToast('Error cargando sucursales');
  }
}

async function remoteConnect(hostId: string) {
  try {
    const result = await (window.api as any).remote?.startViewer?.(hostId);
    if (result?.ok) {
      showToast('Conectando...');
    } else {
      showToast('Error conectando');
    }
  } catch (e: any) {
    showToast('Error conectando');
  }
}

// Event listeners
(document.getElementById('remoteRole') as HTMLSelectElement)?.addEventListener('change', (e) => {
  const role = (e.target as HTMLSelectElement).value;
  if (role === 'host') {
    showHostConfig();
  } else {
    showViewerConfig();
    remoteLoadHosts();
  }
});

(document.getElementById('btnSaveHost') as HTMLButtonElement)?.addEventListener('click', remoteSaveConfig);
(document.getElementById('btnRefreshHosts') as HTMLButtonElement)?.addEventListener('click', remoteLoadHosts);
(document.getElementById('btnStopHost') as HTMLButtonElement)?.addEventListener('click', async () => {
  try {
    await (window.api as any).remote?.stopHost?.();
    showToast('Host detenido');
  } catch (e: any) {
    showToast('Error deteniendo host');
  }
});

// Cargar configuración al iniciar
document.addEventListener('DOMContentLoaded', () => {
  remoteLoadConfig();
});
```

### FASE 6: Configuración de Build

#### 2.9 Actualización de `package.json`
```json
{
  "build": {
    "files": [
      "resources/rustdesk/**/*"
    ],
    "extraResources": [
      {
        "from": "resources/rustdesk",
        "to": "resources/rustdesk",
        "filter": ["**/*"]
      }
    ]
  },
  "scripts": {
    "setup-rustdesk": "chmod +x scripts/setup-rustdesk-server.sh && ./scripts/setup-rustdesk-server.sh"
  }
}
```

#### 2.10 Variables de Entorno (`.env`)
```env
# Control Remoto RustDesk
REMOTE_ID_SERVER=mi-vps.com:21115
REMOTE_RELAY_SERVER=mi-vps.com:21116
ENCRYPTION_KEY=tu-clave-secreta-aqui
```

## 3. ROADMAP DE IMPLEMENTACIÓN

### Semana 1: Estructura Base
- [ ] Crear estructura de archivos del módulo
- [ ] Implementar tipos TypeScript
- [ ] Crear RustDeskManager básico
- [ ] Configurar binarios en resources/

### Semana 2: Servicios Core
- [ ] Implementar RemoteService completo
- [ ] Crear ServerSync para VPS
- [ ] Implementar encriptación de credenciales
- [ ] Agregar handlers IPC

### Semana 3: Interfaz de Usuario
- [ ] Actualizar config.html con nueva sección
- [ ] Implementar lógica de renderer.ts
- [ ] Crear estilos CSS para la interfaz
- [ ] Testing de funcionalidad básica

### Semana 4: Integración y Testing
- [ ] Configurar build con Electron Builder
- [ ] Testing completo del flujo
- [ ] Documentación de uso
- [ ] Optimizaciones y bug fixes

## 4. CONSIDERACIONES DE SEGURIDAD

- **Encriptación**: Credenciales almacenadas encriptadas
- **Autenticación**: Solo administradores pueden acceder
- **Validación**: Validación de entrada en todos los campos
- **Logs**: Registro de todas las conexiones
- **Timeouts**: Timeouts en conexiones para evitar bloqueos

## 5. RESULTADO ESPERADO

Al finalizar la implementación, el proyecto MP Reports tendrá:

✅ **Módulo de Control Remoto integrado**  
✅ **Configuración dual Host/Viewer**  
✅ **Sincronización automática con VPS**  
✅ **Interfaz de usuario intuitiva**  
✅ **Seguridad robusta**  
✅ **Integración completa con el sistema existente**

El módulo permitirá control remoto completo de todas las sucursales desde una interfaz centralizada y segura.
