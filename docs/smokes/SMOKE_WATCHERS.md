# Smoke Test: Watchers

## Objetivo
Verificar que los watchers de archivos funcionan correctamente.

## Pre-requisitos
- Aplicación corriendo
- Configuración válida

## Pasos

### 1. Watcher de facturas
1. Iniciar aplicación en modo Caja
2. Copiar archivo .fac a carpeta monitoreada
3. Esperar procesamiento

**Esperado**:
- [ ] Archivo detectado
- [ ] Procesamiento completado
- [ ] PDF generado
- [ ] Archivo movido a .done/
- [ ] Sin reprocesos

### 2. Cambio de configuración
1. Cambiar ruta de watcher en config
2. Reiniciar watcher

**Esperado**:
- [ ] Watcher se reinicia correctamente
- [ ] Nueva ruta monitoreada
- [ ] Sin errores

## Resultado
- [ ] ✅ PASS
- [ ] ❌ FAIL - Descripción:

## Notas

