# Fase 3: Configuración por UI + Seguridad de Secretos

**Estado**: ⏳ PENDIENTE (después de Fase 2)

**Duración estimada**: 1 semana

**Rama**: `refactor/config-ui-security`

## Objetivo

Reemplazar la dependencia de `.env` en producción por una Settings UI que permite configurar la aplicación desde la interfaz. Implementar almacenamiento seguro con `electron-store` cifrado + `keytar` para secretos sensibles.

## Principio Fundamental

> "En producción NO se usa .env. La configuración se hace desde la UI y se persiste de forma segura. Los secretos NUNCA en texto plano."

## Contexto

**Actualmente**: `.env` opcional en desarrollo para prefill, pero no existe en producción.

**Objetivo**: Configuración 100% desde UI con persistencia segura.

## Tareas Detalladas

### 1. Instalar Dependencias

```bash
pnpm add electron-store keytar
pnpm add -D @types/keytar
```

### 2. Diseñar Modelo de Configuración

#### 2.1 Estructura de configuración

```typescript
// packages/shared/src/types/config.ts

export type Environment = 'development' | 'homologation' | 'production';

export interface AppConfig {
  environment: Environment;
  app: AppSettings;
  afip: AfipConfig;
  arca: ArcaConfig;
  mercadopago: MercadoPagoConfig;
  paths: PathsConfig;
  pdf: PdfConfig;
  email: EmailConfig;
  ftp: FtpConfig;
}

export interface AppSettings {
  companyName: string;
  cuit: string;
  puntoVenta: number;
  autoUpdate: boolean;
}

export interface AfipConfig {
  environment: 'homo' | 'prod';
  cuit: string;
  // Secretos se guardan en keytar, no aquí
  certPath?: string; // Path al cert, no el cert
  keyPath?: string;  // Path a la key, no la key
}

export interface MercadoPagoConfig {
  enabled: boolean;
  // accessToken se guarda en keytar
}

export interface PathsConfig {
  watchFolder: string;
  outputFolder: string;
  doneFolder: string;
  errorFolder: string;
}

// ... más interfaces
```

#### 2.2 Secretos vs Configuración

**Configuración (electron-store cifrado)**:
- Rutas de archivos
- Preferencias de usuario
- Configuraciones no sensibles

**Secretos (keytar)**:
- Tokens de acceso (MP, AFIP)
- Contraseñas (email, FTP)
- Certificados AFIP (contenido)
- API keys

### 3. Implementar Config Service

#### 3.1 packages/infra/src/config/ConfigService.ts

```typescript
import Store from 'electron-store';
import * as keytar from 'keytar';
import { AppConfig } from '@shared/types/config';

const SERVICE_NAME = 'tc-mp-app';

export class ConfigService {
  private store: Store<AppConfig>;
  
  constructor() {
    // electron-store con cifrado
    this.store = new Store<AppConfig>({
      name: 'config',
      encryptionKey: this.getEncryptionKey(),
      defaults: this.getDefaults()
    });
  }
  
  /**
   * Obtener encryption key desde keytar
   * Si no existe, generar y guardar
   */
  private async getEncryptionKey(): Promise<string> {
    const KEY_NAME = 'encryption-key';
    
    let key = await keytar.getPassword(SERVICE_NAME, KEY_NAME);
    
    if (!key) {
      key = this.generateEncryptionKey();
      await keytar.setPassword(SERVICE_NAME, KEY_NAME, key);
    }
    
    return key;
  }
  
  private generateEncryptionKey(): string {
    // Generar key aleatoria segura
    const crypto = require('crypto');
    return crypto.randomBytes(32).toString('hex');
  }
  
  private getDefaults(): Partial<AppConfig> {
    return {
      environment: 'development',
      app: {
        companyName: '',
        cuit: '',
        puntoVenta: 1,
        autoUpdate: true
      },
      paths: {
        watchFolder: '',
        outputFolder: '',
        doneFolder: '',
        errorFolder: ''
      }
    };
  }
  
  // === GET/SET Config ===
  
  get<K extends keyof AppConfig>(key: K): AppConfig[K] | undefined {
    return this.store.get(key);
  }
  
  set<K extends keyof AppConfig>(key: K, value: AppConfig[K]): void {
    this.store.set(key, value);
  }
  
  getAll(): AppConfig {
    return this.store.store;
  }
  
  // === Secretos (keytar) ===
  
  async getSecret(key: string): Promise<string | null> {
    return keytar.getPassword(SERVICE_NAME, key);
  }
  
  async setSecret(key: string, value: string): Promise<void> {
    await keytar.setPassword(SERVICE_NAME, key, value);
  }
  
  async deleteSecret(key: string): Promise<boolean> {
    return keytar.deletePassword(SERVICE_NAME, key);
  }
  
  // === Helpers específicos ===
  
  async getMercadoPagoToken(): Promise<string | null> {
    return this.getSecret('mp-access-token');
  }
  
  async setMercadoPagoToken(token: string): Promise<void> {
    await this.setSecret('mp-access-token', token);
  }
  
  async getAfipCertificate(): Promise<string | null> {
    return this.getSecret('afip-cert');
  }
  
  async setAfipCertificate(cert: string): Promise<void> {
    await this.setSecret('afip-cert', cert);
  }
  
  async getAfipPrivateKey(): Promise<string | null> {
    return this.getSecret('afip-key');
  }
  
  async setAfipPrivateKey(key: string): Promise<void> {
    await this.setSecret('afip-key', key);
  }
  
  // === Testing ===
  
  async testAfipConnection(): Promise<boolean> {
    // Implementar test de conexión
    // Usar credenciales almacenadas
    return true;
  }
  
  async testMercadoPagoConnection(): Promise<boolean> {
    // Test de MP con token almacenado
    return true;
  }
}

export const configService = new ConfigService();
```

### 4. Implementar Settings UI

#### 4.1 apps/electron/renderer/settings.html

```html
<!DOCTYPE html>
<html>
<head>
  <meta charset="UTF-8">
  <title>Configuración - TC-MP</title>
  <link rel="stylesheet" href="settings.css">
</head>
<body>
  <div class="container">
    <h1>Configuración</h1>
    
    <!-- Tabs -->
    <div class="tabs">
      <button class="tab active" data-tab="general">General</button>
      <button class="tab" data-tab="afip">AFIP</button>
      <button class="tab" data-tab="mercadopago">Mercado Pago</button>
      <button class="tab" data-tab="paths">Rutas</button>
      <button class="tab" data-tab="advanced">Avanzado</button>
    </div>
    
    <!-- Tab: General -->
    <div class="tab-content active" id="tab-general">
      <h2>Configuración General</h2>
      
      <label>
        Ambiente:
        <select id="environment">
          <option value="development">Desarrollo</option>
          <option value="homologation">Homologación</option>
          <option value="production">Producción</option>
        </select>
      </label>
      
      <label>
        Razón Social:
        <input type="text" id="companyName" />
      </label>
      
      <label>
        CUIT:
        <input type="text" id="cuit" />
      </label>
      
      <label>
        Punto de Venta:
        <input type="number" id="puntoVenta" />
      </label>
      
      <label>
        <input type="checkbox" id="autoUpdate" />
        Actualizar automáticamente
      </label>
    </div>
    
    <!-- Tab: AFIP -->
    <div class="tab-content" id="tab-afip">
      <h2>Configuración AFIP</h2>
      
      <label>
        Ambiente AFIP:
        <select id="afipEnvironment">
          <option value="homo">Homologación</option>
          <option value="prod">Producción</option>
        </select>
      </label>
      
      <label>
        Certificado (.crt):
        <input type="file" id="afipCert" accept=".crt" />
        <span class="hint">Guardar de forma segura en keytar</span>
      </label>
      
      <label>
        Clave Privada (.key):
        <input type="file" id="afipKey" accept=".key" />
        <span class="hint">Guardar de forma segura en keytar</span>
      </label>
      
      <button id="testAfip">Probar Conexión AFIP</button>
      <span id="afipStatus" class="status"></span>
    </div>
    
    <!-- Tab: Mercado Pago -->
    <div class="tab-content" id="tab-mercadopago">
      <h2>Configuración Mercado Pago</h2>
      
      <label>
        <input type="checkbox" id="mpEnabled" />
        Habilitar integración Mercado Pago
      </label>
      
      <label>
        Access Token:
        <input type="password" id="mpAccessToken" placeholder="APP_USR-..." />
        <span class="hint">Se guarda de forma segura en keytar</span>
      </label>
      
      <button id="testMP">Probar Conexión MP</button>
      <span id="mpStatus" class="status"></span>
    </div>
    
    <!-- Tab: Rutas -->
    <div class="tab-content" id="tab-paths">
      <h2>Rutas de Archivos</h2>
      
      <label>
        Carpeta de entrada (watch):
        <input type="text" id="watchFolder" />
        <button class="browse" data-target="watchFolder">Examinar</button>
      </label>
      
      <label>
        Carpeta de salida (PDFs):
        <input type="text" id="outputFolder" />
        <button class="browse" data-target="outputFolder">Examinar</button>
      </label>
      
      <label>
        Carpeta de procesados:
        <input type="text" id="doneFolder" />
        <button class="browse" data-target="doneFolder">Examinar</button>
      </label>
      
      <label>
        Carpeta de errores:
        <input type="text" id="errorFolder" />
        <button class="browse" data-target="errorFolder">Examinar</button>
      </label>
    </div>
    
    <!-- Buttons -->
    <div class="actions">
      <button id="save" class="primary">Guardar</button>
      <button id="cancel">Cancelar</button>
    </div>
  </div>
  
  <script src="settings-renderer.js"></script>
</body>
</html>
```

#### 4.2 apps/electron/renderer/settings-renderer.ts

```typescript
// IPC para comunicación con main process

// Cargar configuración al abrir
window.addEventListener('DOMContentLoaded', async () => {
  const config = await window.electronAPI.settings.getAll();
  populateForm(config);
});

// Tabs
document.querySelectorAll('.tab').forEach(tab => {
  tab.addEventListener('click', () => {
    const targetTab = tab.getAttribute('data-tab');
    switchTab(targetTab);
  });
});

// Guardar
document.getElementById('save')?.addEventListener('click', async () => {
  const config = collectFormData();
  await window.electronAPI.settings.save(config);
  alert('Configuración guardada');
});

// Test AFIP
document.getElementById('testAfip')?.addEventListener('click', async () => {
  const status = document.getElementById('afipStatus');
  status.textContent = 'Probando...';
  
  const result = await window.electronAPI.settings.testAfip();
  
  if (result.success) {
    status.textContent = '✅ Conexión exitosa';
    status.className = 'status success';
  } else {
    status.textContent = `❌ Error: ${result.error}`;
    status.className = 'status error';
  }
});

// Test MP
document.getElementById('testMP')?.addEventListener('click', async () => {
  const status = document.getElementById('mpStatus');
  status.textContent = 'Probando...';
  
  const result = await window.electronAPI.settings.testMP();
  
  if (result.success) {
    status.textContent = '✅ Conexión exitosa';
    status.className = 'status success';
  } else {
    status.textContent = `❌ Error: ${result.error}`;
    status.className = 'status error';
  }
});

// Browse folders
document.querySelectorAll('.browse').forEach(button => {
  button.addEventListener('click', async () => {
    const target = button.getAttribute('data-target');
    const path = await window.electronAPI.selectFolder();
    if (path) {
      document.getElementById(target).value = path;
    }
  });
});

// Helpers
function populateForm(config: any) {
  // Poblar todos los campos del formulario
  document.getElementById('environment').value = config.environment;
  document.getElementById('companyName').value = config.app.companyName;
  // ... resto de campos
}

function collectFormData(): any {
  return {
    environment: document.getElementById('environment').value,
    app: {
      companyName: document.getElementById('companyName').value,
      // ...
    },
    // ...
  };
}

function switchTab(tabName: string) {
  // Cambiar tab activo
}
```

### 5. Implementar IPC Handlers

#### 5.1 src/main.ts - IPC handlers

```typescript
import { ipcMain, dialog, BrowserWindow } from 'electron';
import { configService } from '@infra/config/ConfigService';

// === Settings IPC ===

ipcMain.handle('settings:getAll', async () => {
  return configService.getAll();
});

ipcMain.handle('settings:get', async (event, key: string) => {
  return configService.get(key as any);
});

ipcMain.handle('settings:set', async (event, key: string, value: any) => {
  configService.set(key as any, value);
  
  // Trigger restart de watchers/services si necesario
  await restartServicesIfNeeded(key);
});

ipcMain.handle('settings:save', async (event, config: any) => {
  // Guardar config completa
  Object.keys(config).forEach(key => {
    configService.set(key as any, config[key]);
  });
  
  // Secretos (si vienen)
  if (config.secrets) {
    for (const [key, value] of Object.entries(config.secrets)) {
      await configService.setSecret(key, value as string);
    }
  }
  
  return { success: true };
});

ipcMain.handle('settings:testAfip', async () => {
  try {
    const result = await configService.testAfipConnection();
    return { success: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('settings:testMP', async () => {
  try {
    const result = await configService.testMercadoPagoConnection();
    return { success: result };
  } catch (error) {
    return { success: false, error: error.message };
  }
});

ipcMain.handle('selectFolder', async () => {
  const result = await dialog.showOpenDialog({
    properties: ['openDirectory']
  });
  return result.canceled ? null : result.filePaths[0];
});

// === Restart services ===

async function restartServicesIfNeeded(configKey: string) {
  if (configKey === 'paths') {
    // Reiniciar watchers con nuevas rutas
    await restartWatchers();
  }
  
  if (configKey === 'afip' || configKey === 'mercadopago') {
    // Reiniciar servicios de integración
    await restartIntegrations();
  }
}
```

#### 5.2 src/preload.ts - Exposición segura

```typescript
import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  settings: {
    getAll: () => ipcRenderer.invoke('settings:getAll'),
    get: (key: string) => ipcRenderer.invoke('settings:get', key),
    set: (key: string, value: any) => ipcRenderer.invoke('settings:set', key, value),
    save: (config: any) => ipcRenderer.invoke('settings:save', config),
    testAfip: () => ipcRenderer.invoke('settings:testAfip'),
    testMP: () => ipcRenderer.invoke('settings:testMP')
  },
  selectFolder: () => ipcRenderer.invoke('selectFolder')
});
```

### 6. Migrar Código Existente a usar ConfigService

#### 6.1 Reemplazar dotenv

**Antes**:
```typescript
import dotenv from 'dotenv';
dotenv.config();

const mpToken = process.env.MP_ACCESS_TOKEN;
```

**Después**:
```typescript
import { configService } from '@infra/config';

const mpToken = await configService.getMercadoPagoToken();
```

#### 6.2 Actualizar servicios

- `src/services/mercadopago.ts` → usar ConfigService
- `src/services/afipService.ts` → usar ConfigService
- Watchers → obtener rutas de ConfigService

### 7. Perfiles Homologation/Production

```typescript
// packages/shared/src/config/profiles.ts

export const PROFILES = {
  development: {
    afip: {
      environment: 'homo',
      endpoint: 'https://wswhomo.afip.gov.ar/...'
    },
    logging: 'debug'
  },
  homologation: {
    afip: {
      environment: 'homo',
      endpoint: 'https://wswhomo.afip.gov.ar/...'
    },
    logging: 'info'
  },
  production: {
    afip: {
      environment: 'prod',
      endpoint: 'https://servicios1.afip.gov.ar/...'
    },
    logging: 'warn'
  }
};
```

## Checklist de Aceptación

- [ ] ConfigService implementado con electron-store cifrado
- [ ] Secretos en keytar (tokens, certs, passwords)
- [ ] Settings UI funcional y accesible desde app
- [ ] IPC handlers settings:get/set/test implementados
- [ ] Tests de conexión AFIP/MP funcionando
- [ ] Código migrado de dotenv a ConfigService
- [ ] Perfiles homologation/production configurados
- [ ] Cambios de config reinician servicios sin cuelgues
- [ ] Documentación de configuración actualizada
- [ ] **Funcionalidad sin cambios**

## Seguridad

- ✅ Secretos NUNCA en texto plano
- ✅ electron-store con encryption
- ✅ Encryption key en keytar
- ✅ IPC expuesto solo lo necesario
- ✅ Validación de inputs en IPC handlers
- ✅ No logs de secretos

## Próxima Fase

**[Fase 4: Infra Resiliente](./FASE_04_infra_resiliente.md)** - HTTP con timeout/retries/circuit-breaker + logger.

---

**Última actualización**: Octubre 2025

