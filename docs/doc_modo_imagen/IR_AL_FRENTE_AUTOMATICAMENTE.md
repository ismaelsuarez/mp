# Ir al Frente Automáticamente - Modo Imagen

## Descripción General
Funcionalidad que permite que las ventanas del modo imagen vayan automáticamente al frente cuando reciben nuevo contenido, sin molestar al usuario en su trabajo diario. Esta característica es especialmente útil para presentaciones, cartelería digital y kioscos donde se necesita que el contenido nuevo sea inmediatamente visible.

## Comportamiento General
- ✅ **Ventana normal**: se mantiene en su posición actual
- ✅ **Solo cuando llega nuevo contenido**: la ventana se activa y va al frente
- ✅ **Después de mostrar**: vuelve al comportamiento normal
- ✅ **No molesta**: no interrumpe el trabajo diario del usuario
- ✅ **Compatible con Windows**: secuencia agresiva para asegurar compatibilidad
- ✅ **Sin interrupción**: No activa la ventana (sin focus) para no interrumpir programas que envían contenido

## Análisis Técnico por Modo de Ventana

### 1. VENTANA=comun
**Ubicación en código**: `src/main.ts` líneas 1857-1865

**Comportamiento**:
- Ventana principal de la aplicación
- Va al frente cuando recibe nuevo contenido
- Mantiene su posición y tamaño normales
- **NO activa la ventana** (sin focus) para no interrumpir programas externos

**Implementación específica**:
```typescript
// Llevar ventana principal al frente sin activarla (sin focus)
try { 
    mainWindow.show(); // Asegurar que esté visible
    mainWindow.moveTop(); // Mover al frente sin activar
    // Métodos adicionales para Windows (sin focus)
    try { mainWindow.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { mainWindow?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}
```

**Casos de uso**:
- Presentación en pantalla única
- Actualización de contenido en ventana principal
- Notificación visual de nuevo contenido
- **Escenarios donde el programa que envía contenido no debe ser interrumpido**

### 2. VENTANA=nueva
**Ubicación en código**: `src/main.ts` líneas 1783-1790 (reutilización) y 1838-1845 (nueva creación)

**Comportamiento**:
- Ventana independiente (modal)
- Va al frente cuando recibe nuevo contenido
- Reutiliza ventana existente bajo política "Producto Nuevo"
- Cierra con tecla ESC
- **NO activa la ventana** (sin focus) para no interrumpir programas externos

**Implementación específica**:
```typescript
// Para ventana reutilizada (Producto Nuevo)
try { 
    lastImageNewWindow.show(); // Asegurar que esté visible
    lastImageNewWindow.moveTop(); // Mover al frente sin activar
    // Métodos adicionales para Windows (sin focus)
    try { lastImageNewWindow.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { lastImageNewWindow?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}

// Para nueva ventana creada
try { 
    win.show(); // Asegurar que esté visible
    win.moveTop(); // Mover al frente sin activar
    // Métodos adicionales para Windows (sin focus)
    try { win.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { win?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}
```

**Casos de uso**:
- Presentación en ventana separada
- Contenido que no debe interferir con la ventana principal
- Múltiples contenidos en ventanas independientes
- **Escenarios donde el programa que envía contenido no debe ser interrumpido**

### 3. VENTANA=comun12
**Ubicación en código**: `src/main.ts` líneas 1698-1705 (ventana principal) y 1761-1768 (ventana espejo)

**Comportamiento**:
- **Ventana Principal**: Ventana principal de la aplicación
- **Ventana Secundaria**: Ventana espejo persistente
- Ambas ventanas van al frente cuando reciben nuevo contenido
- Sincronización perfecta entre ambas ventanas
- **NO activan las ventanas** (sin focus) para no interrumpir programas externos

**Implementación específica**:
```typescript
// Ventana principal
try { 
    mainWindow.show(); // Asegurar que esté visible
    mainWindow.moveTop(); // Mover al frente sin activar
    // Métodos adicionales para Windows (sin focus)
    try { mainWindow.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { mainWindow?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}

// Ventana espejo (secundaria)
try {
    imageDualWindow.show(); // Asegurar que esté visible
    imageDualWindow.moveTop(); // Mover al frente sin activar
    // Métodos adicionales para Windows (sin focus)
    try { imageDualWindow.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { imageDualWindow?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}
```

**Casos de uso**:
- Presentación en múltiples pantallas
- Kioscos con pantalla principal y secundaria
- Contenido espejado para audiencias
- **Escenarios donde el programa que envía contenido no debe ser interrumpido**

## Técnica de Implementación Detallada

### Secuencia de Activación Estándar (SIN FOCUS)
```typescript
try {
    window.show(); // Asegurar que esté visible
    window.moveTop(); // Mover al frente SIN activar (sin focus)
    // Métodos adicionales para Windows (sin focus)
    try { window.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { window?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}
```

### Métodos Utilizados y su Propósito

1. **`show()`**: 
   - Asegura que la ventana esté visible
   - Restaura ventana minimizada si es necesario

2. **`moveTop()`**: 
   - Mueve la ventana al frente de todas las demás
   - **NO activa la ventana** (sin focus)
   - Método estándar de Electron para traer al frente sin interrumpir

3. **`setAlwaysOnTop(true)`**: 
   - Temporalmente mantiene la ventana siempre al frente
   - Especialmente útil en Windows para asegurar visibilidad
   - **NO activa la ventana** (sin focus)

4. **`setTimeout` con `setAlwaysOnTop(false)`**: 
   - Después de 100ms, quita el "always on top"
   - Permite que otras ventanas vuelvan a tener prioridad

### ⚠️ IMPORTANTE: Eliminación del `focus()`

**Problema identificado**:
- El método `focus()` causaba que la ventana recibiera el foco activo
- Esto interrumpía el programa que estaba enviando las imágenes
- El programa perdía prioridad y se detenía

**Solución implementada**:
- **Eliminado `focus()`** de todas las secuencias de activación
- La ventana va al frente **sin activarse**
- El programa que envía contenido mantiene su prioridad
- No hay interrupción en el flujo de trabajo

**Beneficios**:
- ✅ Ventana visible al frente
- ✅ No interrumpe programas externos
- ✅ Mantiene la prioridad del programa que envía contenido
- ✅ Experiencia de usuario mejorada

### Compatibilidad con Windows
- Los métodos adicionales (`setAlwaysOnTop`) están envueltos en `try/catch` para compatibilidad
- La secuencia es más agresiva en Windows para asegurar que la ventana vaya al frente
- El timeout de 100ms es suficiente para que la ventana sea visible sin ser intrusiva
- **Sin `focus()`** para evitar interrupciones

## Casos de Prueba y Escenarios

### Escenario 1: Presentación en Pantalla Única (VENTANA=comun)
**Condiciones iniciales**:
- Usuario trabajando en otras aplicaciones
- Ventana principal en segundo plano
- Programa externo enviando contenido continuamente

**Secuencia de eventos**:
1. Llega nuevo archivo de control (`direccion.txt`)
2. Sistema procesa el archivo
3. Ventana principal se mueve al frente **sin activarse**
4. Contenido se muestra
5. Ventana vuelve a comportamiento normal
6. **Programa externo continúa funcionando sin interrupción**

**Resultado esperado**:
- Usuario ve inmediatamente el nuevo contenido
- No se interrumpe el trabajo en otras aplicaciones
- Ventana no permanece siempre al frente
- **Programa que envía contenido mantiene su prioridad**

### Escenario 2: Presentación en Múltiples Pantallas (VENTANA=comun12)
**Condiciones iniciales**:
- Usuario con dos pantallas configuradas
- Ventana principal en pantalla 1
- Ventana espejo en pantalla 2
- Programa externo enviando contenido continuamente

**Secuencia de eventos**:
1. Llega nuevo archivo de control
2. Ambas ventanas se mueven al frente **sin activarse**
3. Contenido se muestra en ambas pantallas
4. Ambas ventanas van al frente de sus respectivas pantallas
5. **Programa externo continúa funcionando sin interrupción**

**Resultado esperado**:
- Contenido visible en ambas pantallas
- Sincronización perfecta entre ventanas
- Experiencia de presentación profesional
- **Programa que envía contenido mantiene su prioridad**

### Escenario 3: Ventana Independiente con Reutilización (VENTANA=nueva)
**Condiciones iniciales**:
- Usuario ya tiene una ventana nueva abierta
- Política "Producto Nuevo" habilitada
- Programa externo enviando contenido continuamente

**Secuencia de eventos**:
1. Llega nuevo contenido dentro del intervalo de reutilización
2. Ventana existente se reutiliza
3. Ventana va al frente automáticamente **sin activarse**
4. Contenido se actualiza
5. **Programa externo continúa funcionando sin interrupción**

**Resultado esperado**:
- No se crean ventanas duplicadas
- Contenido se actualiza eficientemente
- Ventana va al frente para mostrar cambios
- **Programa que envía contenido mantiene su prioridad**

## Configuración y Control

### Configuraciones Relacionadas
- **`IMAGE_PRODUCTO_NUEVO_ENABLED`**: Habilita reutilización de ventanas nuevas
- **`IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS`**: Intervalo para reutilización
- **`IMAGE_PUBLICIDAD_ALLOWED`**: Modo pantalla completa para ventana espejo

### Control de Comportamiento
Esta funcionalidad está habilitada por defecto y no requiere configuración adicional. Sin embargo, se puede controlar indirectamente a través de:

1. **Configuración de ventanas**: Cada modo de ventana tiene su propia lógica
2. **Políticas de reutilización**: Afectan el comportamiento de VENTANA=nueva
3. **Modo publicidad**: Puede modificar el comportamiento de VENTANA=comun12

## Notas Técnicas Importantes

### Rendimiento
- La secuencia de activación es rápida (< 100ms)
- No afecta el rendimiento general del sistema
- Compatible con múltiples monitores
- **No interrumpe procesos externos**

### Compatibilidad
- **Windows**: Secuencia completa con `setAlwaysOnTop` (sin focus)
- **macOS**: Funciona con métodos estándar de Electron (sin focus)
- **Linux**: Compatible con gestores de ventana estándar (sin focus)

### Manejo de Errores
- Todos los métodos están envueltos en `try/catch`
- Fallback graceful si algún método falla
- No interrumpe el flujo principal de la aplicación
- **No interrumpe programas externos**

### Integración con Otras Funcionalidades
- **Modo Publicidad**: Compatible con pantalla completa
- **Multi-monitor**: Funciona en todas las pantallas
- **Persistencia**: No afecta la memoria de posición/tamaño
- **Programas externos**: No interrumpe el flujo de trabajo

## Archivos Modificados
- `src/main.ts`: Implementación principal (líneas 1698-1865) - **ELIMINADO `focus()`**
- `docs/doc_modo_imagen/MODO_IMAGEN.md`: Documentación actualizada
- `docs/doc_modo_imagen/IR_AL_FRENTE_AUTOMATICAMENTE.md`: Esta documentación técnica

## Versión y Fecha
- **Versión**: 1.0.14
- **Fecha de implementación**: 2025-01-27
- **Estado**: Completamente funcional y probado
- **Cambio importante**: Eliminado `focus()` para evitar interrupciones

---
Última actualización: 2025-01-27 (Eliminado focus() para evitar interrupciones de programas externos)
