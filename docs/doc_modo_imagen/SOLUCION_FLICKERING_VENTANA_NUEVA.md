# 🔧 Solución Flickering - Ventana Nueva (VENTANA=nueva)

## 📋 Problema Identificado

### Descripción
La ventana `VENTANA=nueva` presentaba un efecto de "flickering" o "parpadeo" al abrirse, caracterizado por:
- Apertura no suave visualmente
- Efecto de múltiples ventanas que se acomodan
- Experiencia de usuario no óptima

### Análisis de Causas
1. **Secuencia de creación no optimizada**: La ventana se creaba y luego se posicionaba después de cargar el contenido
2. **Restauración de bounds después de `loadFile()`**: El posicionamiento se realizaba después de cargar el archivo HTML
3. **Múltiples llamadas a `show()`**: La ventana se mostraba en diferentes momentos del proceso

## ✅ Solución Implementada

### 1. Configuración Inicial Optimizada
```typescript
// Preparar configuración inicial optimizada para evitar flickering
const base = mainWindow?.getBounds();
let initialBounds = { x: 0, y: 0, width: 420, height: 420 };

// Intentar restaurar coordenadas guardadas primero
const saved = store.get('imageNewWindowBounds') as { x: number; y: number; width: number; height: number; workW?: number; workH?: number; workX?: number; workY?: number; displayId?: number } | undefined;
if (saved && saved.x !== undefined && saved.y !== undefined && saved.width && saved.height) {
    // Validar que los bounds guardados sean válidos
    try {
        const displays = screen.getAllDisplays();
        let target = saved.displayId !== undefined ? displays.find(d => d.id === saved.displayId) : undefined;
        if (!target) {
            target = screen.getDisplayMatching({ x: saved.x, y: saved.y, width: saved.width, height: saved.height }) || screen.getPrimaryDisplay();
        }
        const work = target.workArea || target.bounds;
        const baseW = saved.workW && saved.workW > 0 ? saved.workW : work.width;
        const baseH = saved.workH && saved.workH > 0 ? saved.workH : work.height;
        const baseX = saved.workX !== undefined ? saved.workX : work.x;
        const baseY = saved.workY !== undefined ? saved.workY : work.y;
        const scaleX = baseW > 0 ? work.width / baseW : 1;
        const scaleY = baseH > 0 ? work.height / baseH : 1;
        const offsetX = saved.x - baseX;
        const offsetY = saved.y - baseY;
        let x = work.x + Math.round(offsetX * scaleX);
        let y = work.y + Math.round(offsetY * scaleY);
        let w = Math.max(420, Math.round(saved.width * scaleX));
        let h = Math.max(420, Math.round(saved.height * scaleY));
        x = Math.max(work.x, Math.min(x, work.x + work.width - 420));
        y = Math.max(work.y, Math.min(y, work.y + work.height - 420));
        initialBounds = { x, y, width: w, height: h };
    } catch {}
} else if (base) {
    // Si no hay bounds guardados, calcular posición centrada
    try {
        const display = screen.getDisplayMatching(base);
        const work = display.workArea || display.bounds;
        const x = Math.max(work.x, Math.min(base.x + Math.floor((base.width - 420) / 2), work.x + work.width - 420));
        const y = Math.max(work.y, Math.min(base.y + Math.floor((base.height - 420) / 2), work.y + work.height - 420));
        initialBounds = { x, y, width: 420, height: 420 };
    } catch {}
}
```

### 2. Creación de Ventana Mejorada
```typescript
const win = new BrowserWindow({
    ...initialBounds,
    title: infoText || path.basename(filePath),
    backgroundColor: '#0f172a',
    show: false, // No mostrar hasta estar listo
    skipTaskbar: false, // Mostrar en la barra de tareas
    alwaysOnTop: false, // No siempre al frente por defecto
    focusable: true, // Permitir focus
    webPreferences: { 
        preload: path.join(app.getAppPath(), 'dist', 'src', 'preload.js'), 
        contextIsolation: true, 
        nodeIntegration: false 
    }
});
```

### 3. Secuencia de Carga Optimizada
```typescript
// Configurar ventana antes de mostrar
try { win.setMenuBarVisibility(false); } catch {}
try { win.setAutoHideMenuBar(true); } catch {}

// Cerrar con ESC
try {
    win.webContents.on('before-input-event', (event, input) => {
        if (input.type === 'keyDown' && (input.key === 'Escape' || input.code === 'Escape')) {
            try { event.preventDefault(); } catch {}
            try { win.close(); } catch {}
        }
    });
} catch {}

// Cargar contenido y mostrar cuando esté listo
await win.loadFile(path.join(app.getAppPath(), 'public', 'imagen.html'));

// Mostrar ventana una sola vez cuando esté completamente lista
win.show();
```

### 4. Bring to Front Suave
```typescript
// La ventana ya se mostró arriba, solo aplicar "bring to front" suave
try { 
    win.moveTop(); // Mover al frente sin activar
    // Métodos adicionales para Windows (sin focus)
    try { win.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { win?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}
```

## 🔄 Extensión a Otras Ventanas

### VENTANA=comun
- **Optimización**: Comentario agregado en `openViewFromTray('imagen')` para clarificar la secuencia de carga
- **Comportamiento**: La ventana principal ya tiene una secuencia de carga optimizada

### VENTANA=comun12 (Espejo)
- **Configuración Inicial**: Misma lógica de `initialBounds` aplicada antes de crear `imageDualWindow`
- **Creación Optimizada**: `show: false` y configuración previa al `loadFile()`
- **Secuencia Mejorada**: `loadFile()` seguido de `show()` una sola vez
- **Bring to Front**: Removido `show()` redundante del "bring to front"

## 🧪 Verificación

### Pasos de Prueba
1. **Abrir VENTANA=nueva**: Verificar apertura suave sin flickering
2. **Abrir VENTANA=comun**: Verificar transición suave al modo imagen
3. **Abrir VENTANA=comun12**: Verificar apertura suave de ventana espejo
4. **Recibir nuevo contenido**: Verificar "bring to front" sin interrumpir programas externos

### Resultados Esperados
- ✅ Apertura suave y visualmente consistente
- ✅ Sin efectos de parpadeo o múltiples ventanas
- ✅ Posicionamiento correcto desde el primer frame
- ✅ Experiencia de usuario fluida

## 📝 Notas Técnicas

### Archivos Modificados
- `src/main.ts`: Optimización de creación y carga de ventanas

### Configuraciones Clave
- `show: false`: Previene mostrar la ventana antes de estar lista
- `skipTaskbar: false`: Asegura visibilidad en la barra de tareas
- `alwaysOnTop: false`: Control del comportamiento por defecto
- `focusable: true`: Permite focus cuando sea necesario

### Compatibilidad
- ✅ Windows (principal objetivo)
- ✅ macOS
- ✅ Linux

---

**Fecha de Implementación**: Diciembre 2024  
**Versión**: 1.0.14  
**Estado**: ✅ Completado y Verificado
