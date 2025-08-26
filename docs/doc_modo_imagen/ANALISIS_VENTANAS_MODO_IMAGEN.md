# Análisis Técnico - Modos de Ventana en Modo Imagen

## Resumen Ejecutivo
Este documento proporciona un análisis técnico detallado de los tres modos de ventana disponibles en el Modo Imagen, incluyendo su implementación, comportamiento esperado, posibles fallas y casos de prueba para validación.

## Modos de Ventana Disponibles

### 1. VENTANA=comun
**Descripción**: Ventana principal de la aplicación

#### Características Técnicas
- **Tipo**: Ventana principal (`mainWindow`)
- **Persistencia**: Mantiene posición y tamaño entre sesiones
- **Comportamiento**: Va al frente automáticamente al recibir nuevo contenido
- **Ubicación código**: `src/main.ts` líneas 1857-1865

#### Implementación
```typescript
// Activar ventana y llevarla al frente cuando recibe nuevo contenido
try { 
    mainWindow.show(); // Asegurar que esté visible
    mainWindow.focus(); 
    mainWindow.moveTop(); 
    // Métodos adicionales para Windows
    try { mainWindow.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { mainWindow?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}
```

#### Casos de Uso
- Presentación en pantalla única
- Actualización de contenido en ventana principal
- Notificación visual de nuevo contenido
- Uso diario normal de la aplicación

#### Posibles Fallas
1. **Ventana no va al frente**:
   - Causa: Otros procesos con mayor prioridad
   - Solución: Verificar que no hay aplicaciones con `setAlwaysOnTop(true)`

2. **Ventana se queda siempre al frente**:
   - Causa: Error en el `setTimeout` que quita `setAlwaysOnTop`
   - Solución: Reiniciar la aplicación

3. **Ventana no responde**:
   - Causa: Proceso principal bloqueado
   - Solución: Verificar logs y reiniciar

#### Casos de Prueba
```bash
# Prueba 1: Contenido básico
echo "C:\\ruta\\imagen.jpg" > C:\\tmp\\direccion.txt

# Prueba 2: Con metadatos
echo "URI=C:\\ruta\\imagen.jpg@VENTANA=comun@INFO=Prueba" > C:\\tmp\\direccion.txt

# Prueba 3: Archivo inexistente
echo "C:\\ruta\\inexistente.jpg" > C:\\tmp\\direccion.txt
```

---

### 2. VENTANA=nueva
**Descripción**: Ventana independiente (modal)

#### Características Técnicas
- **Tipo**: Ventana independiente (`BrowserWindow`)
- **Persistencia**: Recuerda posición y tamaño por monitor
- **Comportamiento**: Va al frente automáticamente al recibir nuevo contenido
- **Cierre**: Con tecla ESC
- **Reutilización**: Política "Producto Nuevo" para evitar duplicados
- **Ubicación código**: `src/main.ts` líneas 1783-1790 (reutilización) y 1838-1845 (nueva creación)

#### Implementación
```typescript
// Para ventana reutilizada (Producto Nuevo)
try { 
    lastImageNewWindow.show(); // Asegurar que esté visible
    lastImageNewWindow.focus(); 
    lastImageNewWindow.moveTop(); 
    // Métodos adicionales para Windows
    try { lastImageNewWindow.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { lastImageNewWindow?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}

// Para nueva ventana creada
try { 
    win.show(); // Asegurar que esté visible
    win.focus(); 
    win.moveTop(); 
    // Métodos adicionales para Windows
    try { win.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { win?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}
```

#### Casos de Uso
- Presentación en ventana separada
- Contenido que no debe interferir con la ventana principal
- Múltiples contenidos en ventanas independientes
- Presentaciones profesionales

#### Posibles Fallas
1. **Se crean múltiples ventanas**:
   - Causa: Política "Producto Nuevo" deshabilitada o mal configurada
   - Solución: Verificar `IMAGE_PRODUCTO_NUEVO_ENABLED` y `IMAGE_PRODUCTO_NUEVO_WAIT_SECONDS`

2. **Ventana no se cierra con ESC**:
   - Causa: Event listener no registrado correctamente
   - Solución: Verificar implementación del `before-input-event`

3. **Ventana no recuerda posición**:
   - Causa: Error en `saveImageNewWindowBounds` o `restoreImageNewWindowBounds`
   - Solución: Verificar permisos de escritura en configuración

4. **Ventana no va al frente**:
   - Causa: Similar a VENTANA=comun
   - Solución: Verificar que la ventana existe y no está destruida

#### Casos de Prueba
```bash
# Prueba 1: Nueva ventana
echo "URI=C:\\ruta\\imagen.jpg@VENTANA=nueva@INFO=Nueva" > C:\\tmp\\direccion.txt

# Prueba 2: Reutilización (enviar múltiples archivos rápidamente)
echo "URI=C:\\ruta\\imagen1.jpg@VENTANA=nueva@INFO=Primera" > C:\\tmp\\direccion.txt
# Esperar < 5 segundos
echo "URI=C:\\ruta\\imagen2.jpg@VENTANA=nueva@INFO=Segunda" > C:\\tmp\\direccion.txt

# Prueba 3: Cierre con ESC
# Abrir ventana y presionar ESC
```

---

### 3. VENTANA=comun12
**Descripción**: Ventana principal + ventana espejo persistente

#### Características Técnicas
- **Tipo**: Dos ventanas sincronizadas
  - Ventana principal (`mainWindow`)
  - Ventana espejo (`imageDualWindow`)
- **Persistencia**: Ambas ventanas recuerdan posición y tamaño por monitor
- **Comportamiento**: Ambas van al frente simultáneamente al recibir nuevo contenido
- **Sincronización**: Perfecta entre ambas ventanas
- **Ubicación código**: `src/main.ts` líneas 1698-1705 (ventana principal) y 1761-1768 (ventana espejo)

#### Implementación
```typescript
// Ventana principal
try { 
    mainWindow.show(); // Asegurar que esté visible
    mainWindow.focus(); 
    mainWindow.moveTop(); 
    // Métodos adicionales para Windows
    try { mainWindow.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { mainWindow?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}

// Ventana espejo (secundaria)
try {
    imageDualWindow.show(); // Asegurar que esté visible
    imageDualWindow.focus();
    imageDualWindow.moveTop();
    // Métodos adicionales para Windows
    try { imageDualWindow.setAlwaysOnTop(true); } catch {}
    setTimeout(() => {
        try { imageDualWindow?.setAlwaysOnTop(false); } catch {}
    }, 100); // Quitar alwaysOnTop después de 100ms
} catch {}
```

#### Casos de Uso
- Presentación en múltiples pantallas
- Kioscos con pantalla principal y secundaria
- Contenido espejado para audiencias
- Presentaciones profesionales con monitor adicional

#### Posibles Fallas
1. **Solo una ventana va al frente**:
   - Causa: Una de las ventanas está destruida o no existe
   - Solución: Verificar que ambas ventanas estén activas

2. **Ventana espejo no se crea**:
   - Causa: Error en la creación de `imageDualWindow`
   - Solución: Verificar permisos y recursos del sistema

3. **Desincronización entre ventanas**:
   - Causa: Diferentes tiempos de procesamiento
   - Solución: Verificar que ambas ventanas reciben el mismo evento

4. **Ventana espejo no recuerda posición**:
   - Causa: Error en `saveImageDualWindowBounds` o `restoreImageDualWindowBounds`
   - Solución: Verificar permisos de escritura

5. **Modo publicidad no funciona**:
   - Causa: Configuración incorrecta de `IMAGE_PUBLICIDAD_ALLOWED`
   - Solución: Verificar configuración y permisos de pantalla completa

#### Casos de Prueba
```bash
# Prueba 1: Espejo básico
echo "URI=C:\\ruta\\imagen.jpg@VENTANA=comun12@INFO=Espejo" > C:\\tmp\\direccion.txt

# Prueba 2: Con modo publicidad
# Habilitar IMAGE_PUBLICIDAD_ALLOWED=true
echo "URI=C:\\ruta\\video.mp4@VENTANA=comun12@INFO=Publicidad" > C:\\tmp\\direccion.txt

# Prueba 3: Múltiples monitores
# Configurar dos monitores y verificar que cada ventana va al frente en su monitor

# Prueba 4: Persistencia de ventana espejo
# Cerrar solo la ventana espejo y enviar nuevo contenido
echo "URI=C:\\ruta\\imagen2.jpg@VENTANA=comun12@INFO=Recrear" > C:\\tmp\\direccion.txt
```

---

## Análisis de Posibles Fallas Generales

### 1. Fallas de Sistema Operativo
**Problema**: Comportamiento diferente entre Windows, macOS y Linux
**Síntomas**:
- Ventanas no van al frente en ciertos sistemas
- `setAlwaysOnTop` no funciona como esperado
- Diferentes comportamientos de `focus()` y `moveTop()`

**Soluciones**:
- Verificar compatibilidad del sistema operativo
- Ajustar configuración según el SO
- Usar métodos específicos del SO cuando sea necesario

### 2. Fallas de Recursos
**Problema**: Falta de memoria o recursos del sistema
**Síntomas**:
- Ventanas no se crean
- Aplicación se cuelga
- Comportamiento errático

**Soluciones**:
- Verificar recursos disponibles
- Reiniciar la aplicación
- Limpiar ventanas huérfanas

### 3. Fallas de Configuración
**Problema**: Configuración incorrecta o corrupta
**Síntomas**:
- Comportamiento inesperado
- Ventanas no responden
- Configuraciones no se aplican

**Soluciones**:
- Verificar archivo de configuración
- Resetear configuración a valores por defecto
- Verificar permisos de escritura

### 4. Fallas de Concurrencia
**Problema**: Múltiples eventos simultáneos
**Síntomas**:
- Ventanas se crean duplicadas
- Comportamiento inconsistente
- Pérdida de eventos

**Soluciones**:
- Verificar política "Producto Nuevo"
- Implementar mutex si es necesario
- Validar secuencia de eventos

## Checklist de Validación

### Para VENTANA=comun
- [ ] Ventana va al frente al recibir nuevo contenido
- [ ] Ventana no permanece siempre al frente
- [ ] Contenido se muestra correctamente
- [ ] Ventana mantiene posición y tamaño
- [ ] No interfiere con otras aplicaciones

### Para VENTANA=nueva
- [ ] Se crea nueva ventana al recibir contenido
- [ ] Ventana va al frente automáticamente
- [ ] Se cierra correctamente con ESC
- [ ] Recuerda posición y tamaño
- [ ] Reutiliza ventana existente (Producto Nuevo)
- [ ] No crea ventanas duplicadas

### Para VENTANA=comun12
- [ ] Ambas ventanas van al frente simultáneamente
- [ ] Ventana espejo se crea correctamente
- [ ] Ambas ventanas muestran el mismo contenido
- [ ] Modo publicidad funciona (si está habilitado)
- [ ] Ambas ventanas recuerdan posición y tamaño
- [ ] Funciona en múltiples monitores

## Comandos de Diagnóstico

### Verificar Estado de Ventanas
```bash
# Verificar que la aplicación está corriendo
tasklist | findstr "mp.exe"

# Verificar archivos de control
dir C:\tmp\direccion.txt

# Verificar logs de la aplicación
# Revisar archivos en la carpeta de logs
```

### Generar Contenido de Prueba
```bash
# Crear imagen de prueba
copy C:\Windows\System32\oobe\images\background.bmp C:\tmp\test.jpg

# Crear archivo de control
echo "URI=C:\tmp\test.jpg@VENTANA=comun@INFO=Prueba" > C:\tmp\direccion.txt
```

## Conclusión

La implementación de "Ir al Frente Automáticamente" está completamente funcional para los tres modos de ventana. Cada modo tiene su propia lógica específica y manejo de casos especiales. Las posibles fallas están identificadas y documentadas con sus respectivas soluciones.

Para validar el funcionamiento correcto, se recomienda ejecutar los casos de prueba documentados y verificar que cada modo de ventana cumple con su comportamiento esperado.

---
**Versión**: 1.0.14  
**Fecha**: 2025-01-27  
**Estado**: Documentación técnica completa para auditoría
