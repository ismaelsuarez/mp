# Resumen Ejecutivo - Modos de Ventana en Modo Imagen

## Información General
**Versión**: 1.0.14  
**Fecha**: 2025-01-27  
**Estado**: Completamente funcional y documentado

## Funcionalidad "Ir al Frente Automáticamente"

### Descripción
Todas las ventanas del modo imagen vayan automáticamente al frente cuando reciben nuevo contenido, sin molestar al usuario en su trabajo diario. Esta característica es especialmente útil para presentaciones, cartelería digital y kioscos.

### Comportamiento General
- ✅ **No intrusivo**: Solo se activa cuando llega nuevo contenido
- ✅ **Compatible con Windows**: Secuencia agresiva para asegurar compatibilidad
- ✅ **Temporal**: La ventana no permanece siempre al frente
- ✅ **Sincronizado**: En modo espejo, ambas ventanas van al frente simultáneamente
- ✅ **Sin interrupción**: No activa la ventana (sin focus) para no interrumpir programas que envían contenido

## ⚠️ CAMBIO IMPORTANTE: Eliminación del `focus()`

### Problema Identificado
- El método `focus()` causaba que la ventana recibiera el foco activo
- Esto interrumpía el programa que estaba enviando las imágenes
- El programa perdía prioridad y se detenía

### Solución Implementada
- **Eliminado `focus()`** de todas las secuencias de activación
- La ventana va al frente **sin activarse**
- El programa que envía contenido mantiene su prioridad
- No hay interrupción en el flujo de trabajo

### Beneficios
- ✅ Ventana visible al frente
- ✅ No interrumpe programas externos
- ✅ Mantiene la prioridad del programa que envía contenido
- ✅ Experiencia de usuario mejorada

## Modos de Ventana Disponibles

### 1. VENTANA=comun
**Tipo**: Ventana principal de la aplicación  
**Comportamiento**: Va al frente automáticamente al recibir nuevo contenido  
**Ubicación código**: `src/main.ts` líneas 1857-1865

**Casos de uso**:
- Presentación en pantalla única
- Actualización de contenido en ventana principal
- Notificación visual de nuevo contenido
- **Escenarios donde el programa que envía contenido no debe ser interrumpido**

**Posibles fallas**:
- Ventana no va al frente (otros procesos con mayor prioridad)
- Ventana se queda siempre al frente (error en setTimeout)
- Ventana no responde (proceso principal bloqueado)

### 2. VENTANA=nueva
**Tipo**: Ventana independiente (modal)  
**Comportamiento**: Va al frente automáticamente al recibir nuevo contenido  
**Cierre**: Con tecla ESC  
**Reutilización**: Política "Producto Nuevo" para evitar duplicados  
**Ubicación código**: `src/main.ts` líneas 1783-1790 (reutilización) y 1838-1845 (nueva creación)

**Casos de uso**:
- Presentación en ventana separada
- Contenido que no debe interferir con la ventana principal
- Múltiples contenidos en ventanas independientes
- **Escenarios donde el programa que envía contenido no debe ser interrumpido**

**Posibles fallas**:
- Se crean múltiples ventanas (política "Producto Nuevo" mal configurada)
- Ventana no se cierra con ESC (event listener no registrado)
- Ventana no recuerda posición (error en persistencia)

### 3. VENTANA=comun12
**Tipo**: Dos ventanas sincronizadas (principal + espejo)  
**Comportamiento**: Ambas van al frente simultáneamente al recibir nuevo contenido  
**Sincronización**: Perfecta entre ambas ventanas  
**Ubicación código**: `src/main.ts` líneas 1698-1705 (ventana principal) y 1761-1768 (ventana espejo)

**Casos de uso**:
- Presentación en múltiples pantallas
- Kioscos con pantalla principal y secundaria
- Contenido espejado para audiencias
- **Escenarios donde el programa que envía contenido no debe ser interrumpido**

**Posibles fallas**:
- Solo una ventana va al frente (una ventana destruida)
- Ventana espejo no se crea (error en creación)
- Desincronización entre ventanas (diferentes tiempos de procesamiento)
- Modo publicidad no funciona (configuración incorrecta)

## Implementación Técnica

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

### Métodos Utilizados
1. **`show()`**: Asegura que la ventana esté visible
2. **`moveTop()`**: Mueve la ventana al frente **sin activarla** (sin focus)
3. **`setAlwaysOnTop(true)`**: Temporalmente mantiene la ventana siempre al frente
4. **`setTimeout`**: Después de 100ms, quita el "always on top"

## Configuraciones Relacionadas

### Configuraciones Principales
- **`IMAGE_PRODUCTO_NUEVO_ENABLED`**: Habilita reutilización de ventanas nuevas
- **`IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS`**: Intervalo para reutilización
- **`IMAGE_PUBLICIDAD_ALLOWED`**: Modo pantalla completa para ventana espejo

### Configuraciones de Ventana
- **`IMAGE_WINDOW_SEPARATE`**: Abrir visor en ventana separada
- **`IMAGE_CONTROL_DIR`**: Carpeta donde se busca el archivo de control
- **`IMAGE_CONTROL_FILE`**: Nombre del archivo de control

## Casos de Prueba

### Pruebas Básicas
```bash
# VENTANA=comun
echo "URI=C:\tmp\test.jpg@VENTANA=comun@INFO=Prueba" > C:\tmp\direccion.txt

# VENTANA=nueva
echo "URI=C:\tmp\test.jpg@VENTANA=nueva@INFO=Prueba" > C:\tmp\direccion.txt

# VENTANA=comun12
echo "URI=C:\tmp\test.jpg@VENTANA=comun12@INFO=Prueba" > C:\tmp\direccion.txt
```

### Pruebas Avanzadas
- **Reutilización**: Enviar múltiples archivos rápidamente
- **Modo publicidad**: Habilitar y probar pantalla completa
- **Archivo inexistente**: Probar fallback visual
- **Múltiples monitores**: Verificar comportamiento en cada pantalla
- **Programas externos**: Verificar que no se interrumpen

## Herramientas de Diagnóstico

### Script de Pruebas
- **Archivo**: `test-ventanas-modo-imagen.bat`
- **Funcionalidad**: Pruebas automatizadas para cada modo de ventana
- **Uso**: Ejecutar como administrador para mejores resultados

### Comandos de Verificación
```bash
# Verificar que la aplicación está corriendo
tasklist | findstr "mp.exe"

# Verificar archivos de control
dir C:\tmp\direccion.txt

# Verificar logs de la aplicación
# Revisar archivos en la carpeta de logs
```

## Checklist de Validación

### VENTANA=comun
- [ ] Ventana va al frente al recibir nuevo contenido
- [ ] Ventana no permanece siempre al frente
- [ ] Contenido se muestra correctamente
- [ ] Ventana mantiene posición y tamaño
- [ ] No interfiere con otras aplicaciones
- [ ] **No interrumpe programas externos que envían contenido**

### VENTANA=nueva
- [ ] Se crea nueva ventana al recibir contenido
- [ ] Ventana va al frente automáticamente
- [ ] Se cierra correctamente con ESC
- [ ] Recuerda posición y tamaño
- [ ] Reutiliza ventana existente (Producto Nuevo)
- [ ] No crea ventanas duplicadas
- [ ] **No interrumpe programas externos que envían contenido**

### VENTANA=comun12
- [ ] Ambas ventanas van al frente simultáneamente
- [ ] Ventana espejo se crea correctamente
- [ ] Ambas ventanas muestran el mismo contenido
- [ ] Modo publicidad funciona (si está habilitado)
- [ ] Ambas ventanas recuerdan posición y tamaño
- [ ] Funciona en múltiples monitores
- [ ] **No interrumpe programas externos que envían contenido**

## Posibles Fallas y Soluciones

### Fallas de Sistema Operativo
- **Problema**: Comportamiento diferente entre Windows, macOS y Linux
- **Solución**: Verificar compatibilidad del sistema operativo

### Fallas de Recursos
- **Problema**: Falta de memoria o recursos del sistema
- **Solución**: Verificar recursos disponibles y reiniciar la aplicación

### Fallas de Configuración
- **Problema**: Configuración incorrecta o corrupta
- **Solución**: Verificar archivo de configuración y permisos

### Fallas de Concurrencia
- **Problema**: Múltiples eventos simultáneos
- **Solución**: Verificar política "Producto Nuevo" y secuencia de eventos

### Fallas de Interrupción (RESUELTO)
- **Problema**: El `focus()` interrumpía programas externos
- **Solución**: Eliminado `focus()` de todas las secuencias de activación

## Documentación Relacionada

### Archivos de Documentación
- `docs/doc_modo_imagen/MODO_IMAGEN.md`: Documentación general del modo imagen
- `docs/doc_modo_imagen/IR_AL_FRENTE_AUTOMATICAMENTE.md`: Documentación técnica detallada
- `docs/doc_modo_imagen/ANALISIS_VENTANAS_MODO_IMAGEN.md`: Análisis técnico completo
- `docs/doc_modo_imagen/RESUMEN_VENTANAS_MODO_IMAGEN.md`: Este resumen ejecutivo

### Archivos de Implementación
- `src/main.ts`: Implementación principal (líneas 1698-1865) - **ELIMINADO `focus()`**
- `public/imagen.html`: Interfaz del visor
- `src/imagen.ts`: Lógica del renderer

## Conclusión

La funcionalidad "Ir al Frente Automáticamente" está completamente implementada y funcional para los tres modos de ventana del modo imagen. Cada modo tiene su propia lógica específica y manejo de casos especiales.

**Cambio importante implementado**: Se eliminó el método `focus()` de todas las secuencias de activación para evitar que se interrumpan los programas externos que envían contenido. Ahora las ventanas van al frente sin activarse, manteniendo la prioridad del programa que envía las imágenes.

La implementación es robusta, compatible con múltiples sistemas operativos y no interfiere con el trabajo diario del usuario ni con programas externos.

Para validar el funcionamiento correcto, se recomienda:
1. Ejecutar el script de pruebas automatizadas
2. Verificar cada modo de ventana individualmente
3. Probar en diferentes configuraciones de monitor
4. Validar el comportamiento en situaciones de carga
5. **Verificar que programas externos no se interrumpen**

---
**Generado por**: Sistema de Documentación Técnica  
**Fecha**: 2025-01-27  
**Versión**: 1.0.14
