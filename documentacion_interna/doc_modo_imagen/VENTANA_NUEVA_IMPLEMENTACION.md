# Ventana Nueva - Modo Imagen - Implementación Técnica

## 📋 Resumen Ejecutivo

La funcionalidad **Ventana nueva** (`VENTANA=nueva`) está **completamente implementada** y funcional en el sistema. Permite abrir el visor de contenidos en una ventana independiente con persistencia de tamaño/posición y política de "Producto nuevo" para evitar múltiples ventanas.

## 🎯 Características Implementadas

### ✅ **Ventana Independiente**
- **Creación**: Nueva ventana Electron con `BrowserWindow`
- **Tamaño inicial**: 420×420 píxeles
- **Fondo**: `#0f172a` (slate-900)
- **Sin menú**: `setMenuBarVisibility(false)` y `setAutoHideMenuBar(true)`

### ✅ **Cierre con ESC**
- **Evento**: `before-input-event` en `webContents`
- **Tecla**: `Escape` o `code === 'Escape'`
- **Acción**: `event.preventDefault()` + `win.close()`

### ✅ **Persistencia de Coordenadas**
- **Guardado**: `saveImageNewWindowBounds()` en eventos `moved` y `resize`
- **Restauración**: `restoreImageNewWindowBounds()` al crear nueva ventana
- **Almacenamiento**: `settings.json` → clave `imageNewWindowBounds`
- **Multi-monitor**: Detecta y adapta a cambios de configuración de pantallas

### ✅ **Política "Producto Nuevo"**
- **Configuración**: `IMAGE_PRODUCTO_NUEVO_ENABLED` y `IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS`
- **Lógica**: Reutiliza última ventana si llegan solicitudes dentro del intervalo
- **Variables**: `lastImageNewWindow` y `lastImageNewWindowAt`
- **Logging**: Registra reutilización con `logInfo()`

### ✅ **Centrado Inteligente**
- **Primera vez**: Centra en el mismo monitor que la ventana principal
- **Siguientes**: Restaura coordenadas guardadas
- **Fallback**: Si no hay coordenadas, centra en monitor principal

### ✅ **Ir al Frente Automáticamente**
- **Nuevo contenido**: Ventana va al frente cuando recibe imagen/video/etc.
- **Comportamiento**: Igual que `VENTANA=comun` - temporalmente `setAlwaysOnTop(true)`
- **Duración**: 100ms de "siempre al frente" para asegurar visibilidad
- **Aplicación**: Tanto en ventanas nuevas como reutilizadas por "Producto Nuevo"

## 🔧 Implementación Técnica

### **Variables Globales** (`src/main.ts:31-32`)
```typescript
let lastImageNewWindow: BrowserWindow | null = null;
let lastImageNewWindowAt = 0; // epoch ms
```

### **Lógica Principal** (`src/main.ts:1765-1821`)
```typescript
// Política Producto Nuevo
const pnEnabled = cfgNow.IMAGE_PRODUCTO_NUEVO_ENABLED === true;
const pnWaitSec = Number(cfgNow.IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS || 0);
const reuseWindow = pnEnabled && Number.isFinite(pnWaitSec) && pnWaitSec > 0 && 
                   (Date.now() - lastImageNewWindowAt) < pnWaitSec * 1000;

if (reuseWindow && lastImageNewWindow && !lastImageNewWindow.isDestroyed()) {
    // Reutilizar ventana existente
    lastImageNewWindow.focus();
    lastImageNewWindow.setTitle(infoText || path.basename(filePath));
    lastImageNewWindow.webContents.send('image:new-content', { 
        filePath, info: infoText, windowMode: 'nueva', fallback: isFallback 
    });
    lastImageNewWindowAt = Date.now();
    return 1;
}

// Crear nueva ventana
const win = new BrowserWindow({
    width: 420,
    height: 420,
    title: infoText || path.basename(filePath),
    backgroundColor: '#0f172a',
    webPreferences: { 
        preload: path.join(app.getAppPath(), 'dist', 'src', 'preload.js'), 
        contextIsolation: true, 
        nodeIntegration: false 
    }
});
```

### **Persistencia de Coordenadas** (`src/main.ts:128-175`)
```typescript
function saveImageNewWindowBounds(win: BrowserWindow | null) {
    if (!win) return;
    const bounds = win.getBounds();
    const display = screen.getDisplayMatching(bounds);
    const work = display.workArea || display.bounds;
    store.set('imageNewWindowBounds', {
        x: bounds.x, y: bounds.y, width: bounds.width, height: bounds.height,
        workW: work.width, workH: work.height, workX: work.x, workY: work.y,
        displayId: display.id
    });
}

function restoreImageNewWindowBounds(win: BrowserWindow, minWidth = 420, minHeight = 420): boolean {
    // Restauración con escalado multi-monitor
    // Adapta coordenadas a cambios de configuración de pantallas
}
```

### **Manejo de Contenido** (`src/imagen.ts:200-238`)
```typescript
window.api.onNewImageContent?.((payload: any) => {
    if (payload && payload.filePath) {
        // Aplicar estilos según modo de ventana
        const mode = String(payload.windowMode || '').toLowerCase();
        if (mode === 'nueva') {
            // Ventana nueva: sin estilos especiales
        }
        showContent(payload.filePath);
    }
});
```

## 📁 Archivos Involucrados

### **Backend (Main Process)**
- `src/main.ts`: Lógica principal de creación y gestión de ventanas
- Variables globales: `lastImageNewWindow`, `lastImageNewWindowAt`
- Funciones: `saveImageNewWindowBounds()`, `restoreImageNewWindowBounds()`

### **Frontend (Renderer Process)**
- `public/imagen.html`: Template HTML para la ventana
- `src/imagen.ts`: Lógica de renderizado de contenido
- `public/style.css`: Estilos base

### **Configuración**
- `settings.json`: Almacenamiento de coordenadas (`imageNewWindowBounds`)
- Configuración de administración: `IMAGE_PRODUCTO_NUEVO_ENABLED`, `IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS`

## 🧪 Casos de Uso

### **1. Primera Apertura**
```
VENTANA=nueva → Crea nueva ventana → Centra en monitor principal → Guarda coordenadas
```

### **2. Reutilización (Producto Nuevo)**
```
Solicitud dentro de intervalo → Reutiliza ventana existente → Refresca contenido → Actualiza timestamp
```

### **3. Nueva Ventana (Fuera de Intervalo)**
```
Solicitud fuera de intervalo → Crea nueva ventana → Restaura coordenadas guardadas
```

### **4. Cierre y Limpieza**
```
ESC → Cierra ventana → Limpia referencia → Mantiene coordenadas para próxima apertura
```

## ⚙️ Configuración

### **Variables de Entorno**
```typescript
IMAGE_PRODUCTO_NUEVO_ENABLED: boolean // Habilita política de reutilización
IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS: number // Intervalo en segundos
```

### **Almacenamiento**
```json
{
  "imageNewWindowBounds": {
    "x": 100, "y": 200, "width": 600, "height": 500,
    "workW": 1920, "workH": 1080, "workX": 0, "workY": 0,
    "displayId": 1
  }
}
```

## 🔍 Logs y Diagnóstico

### **Logs Generados**
- `VENTANA=nueva reutilizada por Producto Nuevo` (con `withinSeconds`)
- `Contenido de imagen procesado` (con `filePath` y `originalContent`)

### **Debugging**
- Verificar `lastImageNewWindow` no es `null`
- Comprobar `lastImageNewWindowAt` timestamp
- Validar configuración `IMAGE_PRODUCTO_NUEVO_*`

## ✅ Estado Actual

**COMPLETAMENTE FUNCIONAL** ✅

- ✅ Ventana independiente creada correctamente
- ✅ Cierre con ESC implementado
- ✅ Persistencia de coordenadas funcionando
- ✅ Política "Producto nuevo" activa
- ✅ Centrado inteligente en multi-monitor
- ✅ Ir al frente automáticamente al recibir contenido
- ✅ Manejo de contenido (imágenes, video, audio, PDF)
- ✅ Logs y diagnóstico implementados

## 🚀 Próximos Pasos (Opcionales)

1. **Mejoras de UX**: Añadir indicador visual de "reutilización"
2. **Configuración avanzada**: Permitir personalizar tamaño inicial
3. **Accesos directos**: Más teclas de control (F11 para fullscreen)
4. **Animaciones**: Transiciones suaves entre contenidos

---

**Fecha de implementación**: Ya implementado y funcional  
**Estado**: ✅ Completamente operativo  
**Pruebas**: Funciona correctamente con `VENTANA=nueva`
