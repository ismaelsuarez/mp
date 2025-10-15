# 📋 Sistema de Configuración - TC-MP

**Última actualización**: 14 de Octubre, 2025  
**Versión**: 1.0.25  
**Estado**: ✅ Documentado

---

## 🎯 Resumen

El sistema de configuración de TC-MP utiliza múltiples fuentes para gestionar diferentes tipos de configuración:

1. **electron-store**: Configuración de usuario (cifrada)
2. **Archivos JSON**: Configuración estática
3. **Variables de entorno**: Configuración de desarrollo
4. **Constantes hardcodeadas**: Defaults y configuración de negocio

---

## 📂 Fuentes de Configuración

### 1. electron-store (settings.json)

**Ubicación**: `app.getPath('userData')/settings.json`  
**Cifrado**: ✅ Sí (encryption key)  
**Gestión**: `src/main.ts` (IPC handlers)

#### Contenido Típico
```typescript
{
  "config": {
    // Configuración de empresa
    "FACT_CUIT": "20123456789",
    "FACT_RAZON_SOCIAL": "Mi Empresa SA",
    "FACT_PUNTO_VENTA": 1,
    
    // Paths de facturación
    "FACT_FAC_DIR": "C:\\facturas\\entrada",
    "FACT_OUT_DIR": "C:\\facturas\\salida",
    "FACT_DONE_DIR": "C:\\facturas\\procesadas",
    "FACT_ERROR_DIR": "C:\\facturas\\error",
    
    // Watchers
    "FACT_FAC_WATCH": true,
    "FACT_PDF_WATCH": true,
    
    // Mercado Pago
    "MP_TOKEN": "TEST-xxx...",
    "MP_AUTO_PROCESS": true,
    
    // Email
    "EMAIL_HOST": "smtp.gmail.com",
    "EMAIL_PORT": 587,
    "EMAIL_USER": "usuario@gmail.com",
    "EMAIL_PASSWORD": "password",
    
    // FTP
    "FTP_HOST": "ftp.miservidor.com",
    "FTP_USER": "usuario",
    "FTP_PASSWORD": "password",
    
    // Modo imagen
    "IMAGE_WATCH_ENABLED": true,
    "IMAGE_PUBLICIDAD_ALLOWED": true,
    
    // AFIP
    "AFIP_SANDBOX": false,
    "AFIP_CERT_PATH": "C:\\cert\\certificado.crt",
    "AFIP_KEY_PATH": "C:\\cert\\clave.key"
  }
}
```

#### API de Acceso

**IPC Handlers** (`src/main.ts`):
```typescript
// Obtener configuración completa
ipcMain.handle('get-config', () => {
  return store.get('config') || {};
});

// Guardar configuración
ipcMain.handle('save-config', (_event, cfg: Record<string, unknown>) => {
  if (cfg && typeof cfg === 'object') {
    const current = (store.get('config') as any) || {};
    store.set('config', { ...current, ...cfg });
    
    // Aplicar cambios
    refreshTrayMenu();
    restartRemoteTimerIfNeeded();
    restartImageTimerIfNeeded();
    restartWatchersIfNeeded();
    
    return true;
  }
  return false;
});
```

#### Seguridad

**Encryption Key**:
```typescript
function getEncryptionKey(): string | undefined {
  const userDataPath = app.getPath('userData');
  const keyPath = path.join(userDataPath, '.enc-key');
  
  try {
    // Leer key si existe
    if (fs.existsSync(keyPath)) {
      return fs.readFileSync(keyPath, 'utf8');
    }
    
    // Generar nueva key
    const crypto = require('crypto');
    const newKey = crypto.randomBytes(32).toString('hex');
    fs.writeFileSync(keyPath, newKey, { mode: 0o600 });
    return newKey;
  } catch {
    return undefined;
  }
}
```

**Protección**:
- ✅ Archivo cifrado con encryption key
- ✅ Key almacenada con permisos restrictivos (0o600)
- ✅ Backup automático si se corrompe
- ✅ IPC para acceso controlado

---

### 2. Archivos JSON Estáticos (config/)

**Ubicación**: `config/*.config.json`  
**Cifrado**: ❌ No (configuración pública)  
**Gestión**: Carga directa en módulos

#### pdf.config.json
```json
{
  "fontRegular": "src/modules/fonts/CONSOLA.TTF",
  "fontBold": "src/modules/fonts/CONSOLAB.TTF"
}
```

**Uso**: Configuración de fuentes para generación de PDFs

#### provincia.config.json
```json
{
  "mendoza": {
    "enabled": true,
    "service": "ATMService",
    "endpoint": "https://atm.mendoza.gov.ar/ws",
    "timeout": 30000,
    "retries": 3,
    "credentials": {
      "usuario": "",
      "password": "",
      "token": ""
    },
    "configuracion": {
      "entorno": "homologacion",
      "version": "1.0",
      "codigoActividad": "541100"
    }
  },
  "caba": { /* ... */ },
  "buenos_aires": { /* ... */ }
}
```

**Uso**: Configuración de servicios provinciales (ATM Mendoza, AGIP CABA, ARBA Buenos Aires)

#### recibo.config.json
```json
{
  "template": "default",
  "formato": {
    "fuente": "Consolas",
    "tamañoFuente": 10
  }
}
```

**Uso**: Plantillas para generación de recibos

#### remito.config.json
```json
{
  "template": "default",
  "formato": {
    "fuente": "Consolas",
    "tamañoFuente": 10
  }
}
```

**Uso**: Plantillas para generación de remitos

#### retencion.config.json
```json
{
  "tiposRetencion": [
    { "codigo": "001", "descripcion": "IVA", "alicuota": 21 },
    { "codigo": "002", "descripcion": "Ganancias", "alicuota": 2 },
    { "codigo": "003", "descripcion": "IIBB", "alicuota": 3 }
  ]
}
```

**Uso**: Tipos y configuración de retenciones

---

### 3. Variables de Entorno

**Uso**: Configuración de desarrollo y testing

#### Variables Principales

| Variable | Descripción | Default |
|----------|-------------|---------|
| `NODE_ENV` | Entorno de ejecución | `development` |
| `AFIP_STUB_MODE` | Mock de AFIP (`ok` \| `error`) | - |
| `SKIP_LICENSE` | Saltear validación de licencia | `false` |
| `DEBUG` | Modo debug (logs extra) | `false` |

#### Uso en Código

```typescript
// src/main.ts
if (process.env.NODE_ENV === 'development') {
  // Modo desarrollo
}

// tests/
process.env.AFIP_STUB_MODE = 'ok'; // Mock AFIP en tests
```

---

### 4. Constantes Hardcodeadas

**Ubicación**: `@shared/constants/*`, `@core/*`  
**Uso**: Configuración de negocio inmutable

#### Ejemplo: AFIP Constants

**Archivo**: `packages/shared/src/constants/afip.ts`
```typescript
export const TIPO_COMPROBANTE_TO_AFIP = {
  'Factura A': 1,
  'Nota de Débito A': 2,
  'Nota de Crédito A': 3,
  'Factura B': 6,
  'Nota de Débito B': 7,
  'Nota de Crédito B': 8,
  // ...
};

export const NTP_SERVERS = [
  'pool.ntp.org',
  'time.google.com',
  'time.cloudflare.com'
];

export const AFIP_DEFAULTS = {
  timeout: 30000,
  retries: 3,
  sandbox: false
};
```

---

## 🔄 Flujo de Configuración

### Carga de Configuración

```
┌──────────────┐
│ Arranque App │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ Cargar settings  │
│ (electron-store) │
└──────┬───────────┘
       │
       ├─ Si no existe → crear default
       ├─ Si corrupto → backup y recrear
       └─ Si OK → continuar
       │
       ▼
┌───────────────────┐
│ Aplicar config a  │
│ servicios         │
└──────┬────────────┘
       │
       ├─ Watchers (FAC, PDF, Imagen)
       ├─ Timers (Remoto, Caja)
       ├─ FTP Server
       └─ Contingency Controller
       │
       ▼
┌───────────────────┐
│ App lista         │
└───────────────────┘
```

### Guardado de Configuración

```
┌──────────────┐
│ Usuario      │
│ cambia config│
│ en UI        │
└──────┬───────┘
       │
       ▼
┌──────────────────┐
│ IPC: save-config │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Validar cambios  │
│ (opcional)       │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Merge con config │
│ existente        │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Guardar en       │
│ electron-store   │
└──────┬───────────┘
       │
       ▼
┌──────────────────┐
│ Aplicar cambios: │
│ - Refresh menu   │
│ - Restart timers │
│ - Restart watch  │
└───────────────────┘
```

---

## 🎯 Mejores Prácticas

### ✅ HACER

1. **Usar IPC para acceder a configuración**
   ```typescript
   // Renderer
   const config = await ipcRenderer.invoke('get-config');
   ```

2. **Validar configuración antes de guardar**
   ```typescript
   if (!isValidCUIT(cfg.FACT_CUIT)) {
     throw new Error('CUIT inválido');
   }
   ```

3. **Aplicar cambios después de guardar**
   ```typescript
   store.set('config', newConfig);
   restartWatchersIfNeeded(); // Aplicar
   ```

4. **Usar defaults**
   ```typescript
   const dir = cfg.FACT_FAC_DIR || 'C:\\tmp';
   ```

### ❌ NO HACER

1. **No acceder directamente al store desde renderer**
   ```typescript
   // ❌ MAL
   const config = store.get('config');
   ```

2. **No guardar secretos sin cifrado**
   ```typescript
   // ❌ MAL
   fs.writeFileSync('password.txt', password);
   ```

3. **No ignorar errores de carga**
   ```typescript
   // ❌ MAL
   try {
     config = JSON.parse(data);
   } catch {}
   ```

4. **No aplicar configuración sin validar**
   ```typescript
   // ❌ MAL
   store.set('config', userInput); // Sin validar
   ```

---

## 🐛 Troubleshooting

### Problema: Configuración corrupta

**Síntoma**: App no arranca, error al cargar settings

**Solución**:
```bash
# Borrar configuración corrupta
rm "C:\Users\<user>\AppData\Roaming\tc-mp\settings.json"

# O renombrar para backup
mv settings.json settings.bak.json
```

La app creará una nueva configuración con defaults.

---

### Problema: Configuración no se aplica

**Síntoma**: Cambios en UI no se reflejan

**Solución**:
1. Verificar que se llame a `save-config` IPC
2. Verificar que se ejecuten los `restart*IfNeeded()`
3. Reiniciar la aplicación

---

### Problema: Encryption key perdida

**Síntoma**: Configuración ilegible, error de decrypt

**Solución**:
```bash
# Borrar key (perderá configuración cifrada)
rm "C:\Users\<user>\AppData\Roaming\tc-mp\.enc-key"

# La app generará nueva key
```

**⚠️ Advertencia**: Perderá toda la configuración cifrada.

---

## 📈 Mejoras Futuras

### Fase 8: Seguridad Avanzada (Opcional)

#### 1. Keytar para Secretos

**Objetivo**: Usar sistema de credenciales del OS

```typescript
import keytar from 'keytar';

// Guardar en Windows Credential Manager
await keytar.setPassword('tc-mp', 'afip-cert', certContent);

// Recuperar
const cert = await keytar.getPassword('tc-mp', 'afip-cert');
```

**Beneficios**:
- ✅ Más seguro (usa credential store del OS)
- ✅ No requiere encryption key propia
- ✅ Mejor integración con OS

**Migración**:
1. Detectar secretos en electron-store
2. Migrar a keytar
3. Limpiar de electron-store
4. Actualizar accesos

---

#### 2. Validación de Esquema

**Objetivo**: Validar configuración con Zod

```typescript
import { z } from 'zod';

const ConfigSchema = z.object({
  FACT_CUIT: z.string().regex(/^\d{11}$/),
  FACT_PUNTO_VENTA: z.number().min(1).max(9999),
  FACT_FAC_DIR: z.string().min(1),
  // ...
});

// Validar antes de guardar
const validConfig = ConfigSchema.parse(userConfig);
store.set('config', validConfig);
```

**Beneficios**:
- ✅ Previene configuración inválida
- ✅ Mensajes de error claros
- ✅ Type-safe

---

#### 3. UI Mejorada

**Objetivo**: Interfaz moderna para configuración

- React/Vue en lugar de HTML plano
- Validación en tiempo real
- Wizard para configuración inicial
- Import/Export de configuración

---

## 📚 Referencias

- [electron-store](https://github.com/sindresorhus/electron-store)
- [keytar](https://github.com/atom/node-keytar)
- [Electron Security](https://www.electronjs.org/docs/latest/tutorial/security)
- [Zod](https://zod.dev/)

---

**Mantenido por**: Equipo de desarrollo TC-MP  
**Última revisión**: Fase 6 - Testing y Configuración  
**Próxima revisión**: Fase 8 - Seguridad y Optimización

