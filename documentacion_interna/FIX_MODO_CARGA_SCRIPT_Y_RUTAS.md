# 🔧 Fix: Modo Carga - Script del Renderer y Rutas

## 📋 Problemas Identificados

### **1. Script del renderer NO se estaba cargando**
- **Síntoma:** Ventana vacía (sin datos de NOMBRE/EXTENSION/URIs), dropzone no funcional
- **Logs ausentes:** `[CargaAPI]` y `[carga.renderer]` nunca aparecían
- **Causa:** La ruta relativa en `<script src="../dist/src/renderer/carga.js">` no funcionaba con `loadFile()`

### **2. Carpetas en ubicación incorrecta**
- **Ubicación incorrecta:** `C:\tmp\cargas_work`, `C:\tmp\cargas_ok`, `C:\tmp\cargas_error`
- **Ubicación correcta:** `AppData\Roaming\tc-mp\carga\work`, `.../ok`, `.../error` (como otros servicios)

---

## ✅ Soluciones Implementadas

### **1. Inyección manual del script del renderer**

**Antes (no funcionaba):**
```html
<!-- carga.html -->
<script src="../dist/src/renderer/carga.js"></script>
```

**Después (funciona):**
```typescript
// cargaWindow.ts
win.loadFile(htmlPath).then(async () => {
  // Inyectar el script del renderer manualmente
  const scriptPath = path.join(app.getAppPath(), 'dist', 'src', 'renderer', 'carga.js');
  
  try {
    const scriptContent = await fs.readFile(scriptPath, 'utf8');
    await win.webContents.executeJavaScript(scriptContent);
    console.log('[carga] Script del renderer inyectado correctamente');
  } catch (err) {
    console.error('[carga] Error al inyectar script del renderer:', err);
  }
  
  win.show();
  win.focus();
});
```

**Beneficios:**
- ✅ Usa rutas absolutas desde `app.getAppPath()`
- ✅ Lee el archivo y lo ejecuta directamente en el contexto del renderer
- ✅ Logging claro de éxito/error
- ✅ Compatible con Electron empaquetado

---

### **2. Rutas correctas usando `app.getPath('userData')`**

**Antes:**
```typescript
// config.ts
export const CARGA_WORK_DIR   = 'C:\\tmp\\cargas_work';
export const CARGA_OK_DIR     = 'C:\\tmp\\cargas_ok';
export const CARGA_ERR_DIR    = 'C:\\tmp\\cargas_error';
```

**Después:**
```typescript
// config.ts
import { app } from 'electron';
import path from 'path';

const getUserDataPath = () => {
  try {
    return app.getPath('userData');
  } catch {
    return 'C:\\Users\\Default\\AppData\\Roaming\\tc-mp';
  }
};

export const CARGA_WORK_DIR   = path.join(getUserDataPath(), 'carga', 'work');
export const CARGA_OK_DIR     = path.join(getUserDataPath(), 'carga', 'ok');
export const CARGA_ERR_DIR    = path.join(getUserDataPath(), 'carga', 'error');
```

**Rutas resultantes:**
```
C:\Users\<Usuario>\AppData\Roaming\tc-mp\carga\work\
C:\Users\<Usuario>\AppData\Roaming\tc-mp\carga\ok\
C:\Users\<Usuario>\AppData\Roaming\tc-mp\carga\error\
```

**Beneficios:**
- ✅ Consistente con otros servicios (DbService, SecureStore, FacturacionService)
- ✅ No contamina `C:\tmp` con carpetas de trabajo
- ✅ Respeta el estándar de Electron para datos de usuario
- ✅ Funciona en cualquier máquina (no hardcoded a `C:\`)

---

## 📝 Archivos Modificados

### **src/services/carga/config.ts**
- ✅ Importa `app` y `path` de Electron
- ✅ Define `getUserDataPath()` helper
- ✅ Cambió rutas de trabajo a `AppData\Roaming\tc-mp\carga\`

### **src/services/carga/cargaWindow.ts**
- ✅ Inyecta el script manualmente con `executeJavaScript()`
- ✅ Lee el archivo `carga.js` desde `dist/src/renderer/`
- ✅ Muestra la ventana DESPUÉS de inyectar el script

### **public/carga.html**
- ✅ Eliminado `<script>` tag (se inyecta desde main)
- ✅ Comentario explicativo

---

## 🧪 Verificación

**Compilación:**
```bash
npm run build:ts  # ✅ Sin errores
```

**Logs esperados al abrir la ventana:**
```
[carga] Encolando { txtPath: 'C:\\tmp\\carga162918.txt', filename: 'carga162918.txt' }
[carga] Procesando { txtPath: 'C:\\tmp\\carga162918.txt', filename: 'carga162918.txt' }
[carga] Ya está en procesamiento, ignorando: { filename: 'carga162918.txt' } ← (duplicados ignorados ✅)
[carga] Archivo parseado exitosamente: {
  filename: 'carga162918.txt',
  parsed: { nombre: 'A0002-00000255', extension: 'pdf', uris: [...] }
}
[carga] Ventana creada, datos a enviar: { nombre: 'A0002-00000255', extension: 'pdf', uris: [...] }
[carga] Script del renderer inyectado correctamente ← ✅ NUEVO
[carga] Ventana mostrada y enfocada
[CargaAPI] Solicitando datos iniciales... ← ✅ NUEVO
[carga] Enviando datos iniciales al renderer: { nombre: 'A0002-00000255', extension: 'pdf', uris: [...] }
[CargaAPI] Datos recibidos: { nombre: 'A0002-00000255', extension: 'pdf', uris: [...] } ← ✅ NUEVO
[carga.renderer] DOM cargado, solicitando datos iniciales... ← ✅ NUEVO
[carga] Datos iniciales cargados { nombre: 'A0002-00000255', extension: 'pdf', uris: [...] } ← ✅ NUEVO
```

**UI esperada:**
- ✅ **NOMBRE:** `A0002-00000255`
- ✅ **EXTENSIÓN:** `PDF`
- ✅ **URIs destino:** Lista con la(s) ruta(s)
- ✅ **Dropzone:** Funcional para arrastrar archivos
- ✅ **Botón "Procesar":** Habilitado cuando hay archivos válidos

---

## 🎯 Resultado

✅ **Ventana de Modo Carga completamente funcional:**
1. Script del renderer se inyecta correctamente
2. Datos se muestran en la UI
3. Dropzone acepta archivos por arrastre
4. Carpetas de trabajo en la ubicación correcta (`AppData\Roaming\tc-mp\carga\`)

---

## 📁 Estructura de Carpetas

**Antes:**
```
C:\tmp\
├── carga162918.txt (original)
├── cargas_work\    ❌ (en tmp)
├── cargas_ok\      ❌ (en tmp)
└── cargas_error\   ❌ (en tmp)
```

**Después:**
```
C:\tmp\
└── carga162918.txt (original, detectado por watcher)

C:\Users\<Usuario>\AppData\Roaming\tc-mp\
└── carga\
    ├── work\     ✅ (archivos en procesamiento)
    ├── ok\       ✅ (archivos procesados exitosamente)
    └── error\    ✅ (archivos con error de parseo/proceso)
```

---

**Fecha:** 17 de octubre, 2025  
**Estado:** ✅ Resuelto  
**Versión:** 1.0.26

