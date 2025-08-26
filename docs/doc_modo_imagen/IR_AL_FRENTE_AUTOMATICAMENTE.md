# Ir al Frente Automáticamente - Modo Imagen

## Descripción
Sistema que lleva automáticamente las ventanas del modo imagen al frente cuando reciben nuevo contenido, sin interrumpir el programa externo que envía las imágenes.

## Función Original (Base)
La función original que funcionaba bien en la mayoría de PCs era:
```typescript
try {
    window.show(); // Asegurar que esté visible
    window.focus(); // ← PROBLEMA: Causa que tome foco activo
    window.moveTop(); // Mover al frente sin activar
    try { window.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { window?.setAlwaysOnTop(false); } catch {}
    }, 100);
} catch {}
```

## Problema Identificado
- `window.focus()` causa que la ventana tome el foco activo
- En algunos equipos, esto interrumpe el programa externo que envía imágenes
- El programa pierde prioridad y se detiene

## Solución Implementada
Se modificó la función original removiendo `window.focus()`:

```typescript
try {
    window.show(); // Asegurar que esté visible
    // window.focus(); // ← REMOVIDO: Causa que tome foco activo
    window.moveTop(); // Mover al frente sin activar
    try { window.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { window?.setAlwaysOnTop(false); } catch {}
    }, 100);
} catch {}
```

## Funciones por Método

### `window.show()`
- **Propósito**: Hacer visible la ventana si está oculta
- **Comportamiento**: Garantiza que la ventana sea visible para el usuario
- **Necesario**: Sí, para asegurar que las imágenes se actualicen correctamente

### `window.moveTop()`
- **Propósito**: Cambiar el orden Z de la ventana (traer al frente)
- **Comportamiento**: Mueve la ventana al frente sin tomar foco activo
- **Necesario**: Sí, para que la ventana aparezca por encima de otras

### `window.setAlwaysOnTop()`
- **Propósito**: Forzar temporalmente que la ventana esté siempre visible
- **Comportamiento**: Se activa por 100ms y luego se desactiva
- **Necesario**: Sí, para garantizar visibilidad en Windows

## Ventanas Aplicadas

### 1. VENTANA=comun (mainWindow)
- Ventana principal del modo imagen
- Se aplica la lógica de "ir al frente" automático

### 2. VENTANA=nueva (win / lastImageNewWindow)
- Ventana independiente para "Producto Nuevo"
- Política de reutilización de ventanas
- Se aplica la lógica de "ir al frente" automático

### 3. VENTANA=comun12 (imageDualWindow)
- Ventana espejo para "Publicidad"
- Modo kiosk, pantalla completa, siempre visible
- Se aplica la lógica de "ir al frente" automático

## Beneficios de la Solución

1. **No Interrumpe Programas Externos**: Al remover `window.focus()`, el programa que envía imágenes mantiene su prioridad
2. **Mantiene Visibilidad**: `window.show()` asegura que las imágenes se actualicen
3. **Trae al Frente**: `window.moveTop()` coloca la ventana por encima de otras
4. **Compatibilidad**: Funciona en todos los equipos sin causar problemas de foco

## Implementación Técnica

La lógica se aplica en `src/main.ts` en las siguientes ubicaciones:

1. **mainWindow** (VENTANA=comun): Líneas ~1699-1710
2. **imageDualWindow** (VENTANA=comun12): Líneas ~1750-1760
3. **lastImageNewWindow** (VENTANA=nueva, reutilización): Líneas ~1800-1810
4. **win** (VENTANA=nueva, nueva ventana): Líneas ~1850-1860

## Resultado Esperado

- Las ventanas del modo imagen se muestran automáticamente al frente cuando reciben contenido
- El programa externo que envía imágenes mantiene su prioridad y no se interrumpe
- Las imágenes se actualizan correctamente en todas las ventanas
- Funciona de manera consistente en todos los equipos
