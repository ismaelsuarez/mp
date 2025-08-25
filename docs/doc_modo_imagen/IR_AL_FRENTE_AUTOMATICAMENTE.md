# Ir al Frente Automáticamente - Modo Imagen

## Descripción
Funcionalidad que permite que las ventanas del modo imagen vayan automáticamente al frente cuando reciben nuevo contenido, sin molestar al usuario en su trabajo diario.

## Comportamiento
- ✅ **Ventana normal**: se mantiene en su posición actual
- ✅ **Solo cuando llega nuevo contenido**: la ventana se activa y va al frente
- ✅ **Después de mostrar**: vuelve al comportamiento normal
- ✅ **No molesta**: no interrumpe el trabajo diario del usuario

## Ventanas que implementan esta funcionalidad

### 1. VENTANA=comun
- **Ventana**: Principal de la aplicación
- **Comportamiento**: Va al frente cuando recibe nuevo contenido
- **Implementación**: Líneas 1698-1701 en `src/main.ts`

### 2. VENTANA=nueva
- **Ventana**: Ventana independiente (modal)
- **Comportamiento**: Va al frente cuando recibe nuevo contenido
- **Implementación**: 
  - Reutilización (líneas 1771-1778 en `src/main.ts`)
  - Nueva creación (líneas 1815-1822 en `src/main.ts`)

### 3. VENTANA=comun12
- **Ventana Principal**: Ventana principal de la aplicación
- **Ventana Secundaria**: Ventana espejo persistente
- **Comportamiento**: Ambas ventanas van al frente cuando reciben nuevo contenido
- **Implementación**:
  - Ventana principal (líneas 1698-1701 en `src/main.ts`)
  - Ventana secundaria (líneas 1761-1768 en `src/main.ts`)

## Técnica de implementación

### Secuencia de activación
```typescript
try {
    window.show(); // Asegurar que esté visible
    window.focus();
    window.moveTop();
    // Métodos adicionales para Windows
    try { window.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { window?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}
```

### Métodos utilizados
1. **`show()`**: Asegura que la ventana esté visible
2. **`focus()`**: Da foco a la ventana
3. **`moveTop()`**: Mueve la ventana al frente
4. **`setAlwaysOnTop(true)`**: Temporalmente la mantiene siempre al frente
5. **`setTimeout`**: Después de 100ms, quita el "always on top"

### Compatibilidad con Windows
- Los métodos adicionales (`setAlwaysOnTop`) están envueltos en `try/catch` para compatibilidad
- La secuencia es más agresiva en Windows para asegurar que la ventana vaya al frente

## Casos de uso

### Escenario 1: Presentación en pantalla
- Usuario está trabajando en otras aplicaciones
- Llega nueva imagen para mostrar
- Ventana de imagen va al frente automáticamente
- Usuario ve el contenido actualizado
- Ventana vuelve a comportamiento normal

### Escenario 2: VENTANA=comun12 (Espejo)
- Usuario tiene dos pantallas configuradas
- Llega nuevo contenido
- Ambas ventanas (principal y espejo) van al frente
- Contenido se muestra en ambas pantallas simultáneamente

### Escenario 3: VENTANA=nueva (Reutilización)
- Usuario ya tiene una ventana nueva abierta
- Llega nuevo contenido
- La ventana existente se reutiliza y va al frente
- No se crean ventanas duplicadas

## Configuración
Esta funcionalidad está habilitada por defecto y no requiere configuración adicional.

## Notas técnicas
- La funcionalidad se ejecuta solo cuando hay nuevo contenido
- No afecta el comportamiento normal de las ventanas
- Compatible con todos los modos de ventana
- Funciona en Windows y otros sistemas operativos
- No interfiere con el modo publicidad o pantalla completa

## Archivos modificados
- `src/main.ts`: Implementación principal
- `docs/doc_modo_imagen/MODO_IMAGEN.md`: Documentación actualizada
- `docs/doc_modo_imagen/IR_AL_FRENTE_AUTOMATICAMENTE.md`: Esta documentación

---
Última actualización: 2025-01-27 (Implementación completa para todas las ventanas)
