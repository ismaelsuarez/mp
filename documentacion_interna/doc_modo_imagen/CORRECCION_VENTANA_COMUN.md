# Corrección del Problema con VENTANA=comun

## Problema Identificado

Después de implementar `VENTANA=comun2`, se detectó que `VENTANA=comun` estaba abriendo una ventana nueva en lugar de reutilizar la ventana principal existente.

## Causa del Problema

El error estaba en la lógica de `finalWindowMode` en la función `processImageControlOnce()`:

```typescript
// CÓDIGO INCORRECTO (antes de la corrección)
const finalWindowMode = forceSeparateWindow ? 'nueva' : (windowMode || 'comun');
```

**Problema**: Cuando `IMAGE_WINDOW_SEPARATE` estaba habilitado (`forceSeparateWindow = true`), cualquier solicitud (incluyendo `VENTANA=comun`) se convertía en `'nueva'`, causando que se abriera una ventana nueva.

## Solución Implementada

Se modificó la lógica para priorizar explícitamente `VENTANA=comun`:

```typescript
// CÓDIGO CORREGIDO
const finalWindowMode = (windowMode === 'comun') ? 'comun' : (forceSeparateWindow ? 'nueva' : (windowMode || 'comun'));
```

**Lógica de la corrección**:
1. **Si `windowMode === 'comun'`**: Siempre usar `'comun'` (ventana principal), independientemente de `IMAGE_WINDOW_SEPARATE`
2. **Si `windowMode` es otro valor**: Aplicar la lógica normal de `forceSeparateWindow`

## Comportamiento Esperado Después de la Corrección

- **`VENTANA=comun`**: ✅ Siempre reutiliza la ventana principal existente
- **`VENTANA=nueva`**: ✅ Abre una ventana nueva (comportamiento original)
- **`VENTANA=comun12`**: ✅ Actualiza ambas ventanas (principal + espejo)
- **`VENTANA=comun2`**: ✅ Solo actualiza la ventana espejo (sin tocar la principal)
- **Sin `VENTANA=` especificado**: ✅ Respeta la configuración `IMAGE_WINDOW_SEPARATE`

## Archivos Modificados

- `src/main.ts`: Línea ~2064 - Corrección de la lógica de `finalWindowMode`

## Archivos de Prueba Creados

- `chat/comandos/ventana_comun.txt`: Comando de prueba para `VENTANA=comun`
- `chat/comandos/ventana_comun2.txt`: Comando de prueba para `VENTANA=comun2`

## Verificación

Para verificar que la corrección funciona:

1. Ejecutar el comando `VENTANA=comun` - debe reutilizar la ventana principal
2. Ejecutar el comando `VENTANA=comun2` - debe crear/actualizar solo la ventana espejo
3. Verificar que `VENTANA=comun12` siga funcionando correctamente
4. Confirmar que `VENTANA=nueva` siga abriendo ventanas nuevas

## Fecha de Corrección

**2025-01-03**: Se identificó y corrigió el problema de regresión en `VENTANA=comun`.
