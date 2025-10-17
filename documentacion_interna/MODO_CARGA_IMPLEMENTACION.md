# 📁 Modo Carga - Documentación de Implementación

## 📋 Resumen

Sistema para cargar archivos desde `C:\tmp` mediante archivos de control `carga*.txt`. Reutiliza el watcher existente de `mp.txt`/`dolar.txt` sin crear infraestructura nueva.

---

## 🎯 Funcionalidad

### 1️⃣ **Detección automática**
- **Watcher:** `startRemoteWatcher()` en `src/main.ts` (línea ~2055)
- **Patrón:** `/^carga.*\.txt$/i`
- **Directorio:** `C:\tmp` (configurable via `AUTO_REMOTE_DIR`)

### 2️⃣ **Formato del archivo carga*.txt**

```txt
NOMBRE: 02125123
EXTENSION: pdf
URI= C:\tmp\destino1
URI= C:\tmp\destino2
URI= \\servidor\compartido\carpeta
```

**Reglas:**
- `NOMBRE:` — Obligatorio, base para archivos (sin extensión)
- `EXTENSION:` — Obligatorio, extensión esperada (sin punto)
- `URI=` — 1..N líneas, primera obligatoria
- Soporta rutas UNC (`\\servidor\share`) y locales (`C:\...`)

### 3️⃣ **Flujo de procesamiento**

```
┌─────────────────────────────────────────────┐
│ 1. Detectado carga1234.txt en C:\tmp       │
│    ↓ startRemoteWatcher() detecta archivo  │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 2. handleCargaFile()                        │
│    ↓ Encola el archivo                      │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 3. CargaQueue.ts                            │
│    ↓ Espera estabilidad                     │
│    ↓ Mueve a C:\tmp\cargas_work             │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 4. CargaParser.ts                           │
│    ↓ Parsea NOMBRE/EXTENSION/URIs           │
│    ↓ Valida campos obligatorios             │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 5. openCargaWindow() (cargaWindow.ts)       │
│    ↓ Abre ventana con datos parseados       │
└─────────────────────────────────────────────┘
                    ↓
┌─────────────────────────────────────────────┐
│ 6. Usuario en UI (carga.html)               │
│    ↓ Drag & Drop archivos                   │
│    ↓ Valida extensiones                     │
│    ↓ Muestra tabla: real → destino          │
│    ↓ Botones: [Anular] [Procesar]           │
└─────────────────────────────────────────────┘
                    ↓
         ┌──────────┴──────────┐
         │                     │
    [Anular]              [Procesar]
         │                     │
   Borra .txt       CargaProcessor.ts
   Cierra UI         ↓ Copia a URIs
                     ↓ Borra .txt
                     ↓ Muestra ✅ OK
                     ↓ Cierra UI (2s)
```

---

## 📂 Estructura de archivos

### **Servicios**
```
src/services/carga/
├── config.ts            # Constantes (dirs, timeouts)
├── fsUtils.ts           # ensureDir() helper
├── CargaParser.ts       # Parsea carga*.txt
├── CargaProcessor.ts    # Copia archivos a URIs
├── CargaQueue.ts        # Cola FIFO + estabilidad
└── cargaWindow.ts       # BrowserWindow factory
```

### **Preload & Renderer**
```
src/preload/
└── carga.preload.ts     # IPC bridge seguro

src/renderer/
└── carga.ts             # Lógica UI (drag&drop, tabla)
```

### **UI**
```
public/
└── carga.html           # Interfaz gráfica
```

### **Integración**
```
src/main.ts
├── import { enqueueCarga } from './services/carga/CargaQueue'
├── handleCargaFile()        # Handler llamado por watcher
└── startRemoteWatcher()     # Modificado para incluir carga*.txt
```

---

## 🔑 Características Clave

### ✅ **Validación de extensiones**
- El sistema compara la extensión real del archivo con la esperada
- Si no coincide, muestra error en rojo y no permite procesar
- Ejemplo:
  - Esperado: `.pdf`
  - Dropeado: `archivo.docx` → ❌ Error

### ✅ **Nombres automáticos**
- Primer archivo: `NOMBRE.ext`
- Siguientes: `NOMBRE-1.ext`, `NOMBRE-2.ext`, etc.
- Ejemplo:
  ```
  factura.pdf    → 02125123.pdf
  factura2.pdf   → 02125123-1.pdf
  factura3.pdf   → 02125123-2.pdf
  ```

### ✅ **Múltiples destinos**
- Copia el mismo archivo a TODAS las URIs listadas
- Crea directorios automáticamente si no existen
- Respeta mayúsculas/minúsculas del path original

### ✅ **Cola secuencial**
- Si llegan múltiples `carga*.txt`, se procesan uno por vez
- No se abre una ventana hasta que la anterior se cierre

### ✅ **Gestión de archivos**
- **Éxito:** `.txt` movido a `C:\tmp\cargas_ok`
- **Error:** `.txt` movido a `C:\tmp\cargas_error`
- **Cancelado:** `.txt` borrado

---

## 🎨 UI/UX

### **Ventana principal**
- Tamaño: 900×620
- `alwaysOnTop: true` (sube al frente sin robar foco)
- Estilo: Tailwind CSS (similar a Modo Imagen)

### **Secciones**
1. **Header:** Título + descripción
2. **Metadata:** Muestra NOMBRE, EXTENSION, URIs
3. **Dropzone:** Área drag & drop (click para explorar)
4. **Tabla:** Nombre real → Nombre destino + botón borrar
5. **Botones:** [Anular] (rojo) + [Procesar] (verde)

### **Overlay de éxito**
- Muestra ✅ "OK" grande centrado
- Cierra automáticamente después de 2 segundos

---

## 🔧 IPC Channels

Cada ventana tiene un canal único basado en `windowCounter`:

```typescript
carga:1:request-init  → Solicitar datos iniciales
carga:1:init          → Recibir { nombre, extension, uris }
carga:1:cancel        → Anular carga
carga:1:process       → Procesar archivos (envía array)
carga:1:done          → Procesamiento exitoso
carga:1:error         → Error al procesar
```

---

## 🧪 Ejemplo de prueba

### **Archivo:** `tmp/carga.txt`
```txt
NOMBRE: 02125123
EXTENSION: pdf
URI= C:\tmp\destino1
URI= C:\tmp\destino2
```

### **Pasos:**
1. Copiar el archivo a `C:\tmp\carga.txt`
2. El watcher lo detecta automáticamente
3. Se abre la ventana de carga
4. Arrastrar archivos `.pdf`
5. Click en "Procesar"
6. Los archivos se copian a ambos destinos
7. Muestra "OK" y cierra

---

## ⚙️ Configuración

### **Directorios (src/services/carga/config.ts)**
```typescript
CARGA_SOURCE_DIR  = 'C:\\tmp'
CARGA_WORK_DIR    = 'C:\\tmp\\cargas_work'
CARGA_OK_DIR      = 'C:\\tmp\\cargas_ok'
CARGA_ERR_DIR     = 'C:\\tmp\\cargas_error'
```

### **Comportamiento**
```typescript
SUCCESS_MILLISECONDS = 2000  // Duración del cartel OK
WINDOW_DIMENSIONS    = { width: 900, height: 620 }
```

---

## 🚀 Integración con Modo Imagen

### **Compatibilidad:**
- ✅ No toca la lógica de `public/imagen.html`
- ✅ Usa el mismo sistema de logging (LogService)
- ✅ Respeta el estilo "subir al frente" sin robar foco
- ✅ No interfiere con el watcher de `direccion.txt`

### **Watchers activos:**
1. **Remote Watcher:** `mp*.txt`, `dolar.txt`, `a13*.txt`, **`carga*.txt`** ⬅️ NUEVO
2. **Image Watcher:** `direccion.txt`
3. **Contingency Watcher:** `.fac` (ContingencyController)

---

## 📊 Logging

### **Mensajes clave:**
```javascript
logInfo('Detectado carga*.txt', { filename, fullPath });
logInfo('Remote watcher started (incluye carga*.txt)', { dir });
logError('Error al encolar carga*.txt', { filename, error });
```

### **Console (ventana de carga):**
```javascript
console.log('[carga] Encolando', { txtPath, filename });
console.log('[carga] Procesando archivos', { count, uris });
console.log('[carga] ✅ Procesado exitosamente', { filename });
console.error('[carga] ❌ Error al procesar', { error });
```

---

## 🛡️ Seguridad

### **Validaciones:**
- ✅ Sanitización de `NOMBRE:` (remueve caracteres inválidos)
- ✅ Normalización de `EXTENSION:` (lowercase, sin punto)
- ✅ Comprobación de extensión real vs esperada
- ✅ Creación segura de directorios (recursive: true)

### **IPC:**
- ✅ `contextIsolation: true`
- ✅ `nodeIntegration: false`
- ✅ `contextBridge` para exponer API limitada

---

## 📝 Notas técnicas

### **Estabilidad de archivos**
El sistema espera 300ms × 10 intentos para verificar que el archivo no está siendo escrito (tamaño y `mtimeMs` estables). Esto evita errores cuando FTP está subiendo archivos grandes.

### **Rutas UNC**
Compatible con rutas de red (`\\servidor\share\carpeta`). `fs.mkdir` con `recursive: true` maneja correctamente ambos tipos.

### **Múltiples ventanas**
Si llegan 3 archivos `carga*.txt` simultáneamente:
1. Se encolan los 3
2. Se procesa el primero (abre ventana)
3. Cuando el usuario cierra la ventana, se procesa el segundo
4. Y así sucesivamente

---

## ✅ Criterios de aceptación

| # | Criterio | Estado |
|---|----------|--------|
| 1 | Detecta `carga*.txt` en `C:\tmp` | ✅ |
| 2 | Parsea `NOMBRE:`, `EXTENSION:`, `URI=` | ✅ |
| 3 | Valida campos obligatorios | ✅ |
| 4 | Abre ventana con dropzone | ✅ |
| 5 | Valida extensión de archivos dropeados | ✅ |
| 6 | Genera nombres automáticos (NOMBRE, NOMBRE-1, ...) | ✅ |
| 7 | Copia a todas las URIs | ✅ |
| 8 | Crea directorios si no existen | ✅ |
| 9 | Borra `.txt` al Anular o Procesar exitosamente | ✅ |
| 10 | Muestra "OK" 2s y cierra | ✅ |
| 11 | Soporta múltiples `carga*.txt` (cola) | ✅ |
| 12 | No rompe Modo Imagen ni otros watchers | ✅ |
| 13 | Soporta rutas UNC y locales | ✅ |
| 14 | Compila sin errores (`tsc -p tsconfig.json`) | ✅ |

---

## 🔄 Cambios realizados

### **Archivos modificados:**
- `src/main.ts` (líneas 29, 2041-2075)
  - Importa `enqueueCarga`
  - Agrega `handleCargaFile()`
  - Extiende regex de `startRemoteWatcher()`

### **Archivos creados:**
- `src/services/carga/config.ts`
- `src/services/carga/fsUtils.ts`
- `src/services/carga/CargaParser.ts`
- `src/services/carga/CargaProcessor.ts`
- `src/services/carga/CargaQueue.ts`
- `src/services/carga/cargaWindow.ts`
- `src/preload/carga.preload.ts`
- `src/renderer/carga.ts`
- `public/carga.html`
- `documentacion_interna/MODO_CARGA_IMPLEMENTACION.md` (este archivo)
- `tmp/carga.txt` (ejemplo de prueba)

---

## 🎉 Resultado

Sistema **Modo Carga** 100% funcional, integrado con el watcher existente, sin dependencias externas ni archivos nuevos de configuración. Listo para compilar y desplegar.

**Compilación:**
```bash
npm run build:ts  # ✅ Sin errores
npm run build     # ✅ Genera ejecutable
```

---

**Fecha:** 17 de octubre, 2025  
**Estado:** ✅ Implementado y documentado  
**Versión:** 1.0.26

