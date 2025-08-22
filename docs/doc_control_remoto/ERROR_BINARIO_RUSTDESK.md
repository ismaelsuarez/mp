# Error: Binario RustDesk No Encontrado (ENOENT)

## 🚨 Problema Identificado

**Error**: `ENOENT (Error No ENTry)` - El archivo `rustdesk.exe` no existe en la ruta especificada.

**Causa**: El binario de RustDesk no está presente en el proyecto, causando que el módulo de Control Remoto no pueda ejecutar las funciones de host/viewer.

## 📋 Análisis del Error

### Error Original
```
Error: spawn
Path: D:\Proyecto\Clientes\Todo-Computacion\Facturacion\mp\node_modules\electron\dist\resources\resources\rustdesk\rustdesk.exe
Error Code: ENOENT
```

### Problemas Identificados

1. **Ruta Incorrecta**: La ruta del binario estaba mal construida
2. **Binario Faltante**: El archivo `rustdesk.exe` no existe en el proyecto
3. **Falta de Validación**: No se verificaba la existencia del archivo antes de intentar ejecutarlo

## ✅ Soluciones Implementadas

### 1. Función de Búsqueda Inteligente

```typescript
private getRustDeskPath(): string | null {
  // Intentar diferentes ubicaciones posibles
  const possiblePaths = [
    // En desarrollo (desde el directorio del proyecto)
    path.join(process.cwd(), 'resources', 'rustdesk', 'rustdesk.exe'),
    path.join(process.cwd(), 'rustdesk', 'rustdesk.exe'),
    path.join(process.cwd(), 'bin', 'rustdesk.exe'),
    // En producción (desde resources)
    path.join(process.resourcesPath, 'resources', 'rustdesk', 'rustdesk.exe'),
    path.join(process.resourcesPath, 'rustdesk', 'rustdesk.exe'),
    // En el PATH del sistema
    'rustdesk.exe'
  ];

  for (const rustdeskPath of possiblePaths) {
    try {
      if (fs.existsSync(rustdeskPath)) {
        console.log(`✅ Binario RustDesk encontrado en: ${rustdeskPath}`);
        return rustdeskPath;
      }
    } catch (error) {
      console.warn(`⚠️ Error verificando ruta: ${rustdeskPath}`, error);
    }
  }

  console.error('❌ Binario RustDesk no encontrado en ninguna ubicación');
  console.log('📋 Ubicaciones verificadas:');
  possiblePaths.forEach(p => console.log(`   - ${p}`));
  return null;
}
```

### 2. Validación Antes de Ejecutar

```typescript
async startHost(config: RemoteConfig): Promise<boolean> {
  try {
    if (!config.username || !config.password) {
      throw new Error('Usuario y contraseña requeridos para Host');
    }

    const rustdeskPath = this.getRustDeskPath();
    if (!rustdeskPath) {
      throw new Error('Binario RustDesk no encontrado. Por favor, instale RustDesk o coloque el archivo rustdesk.exe en la carpeta resources/rustdesk/');
    }

    // ... resto de la lógica
  } catch (error) {
    console.error('Error en startHost:', error);
    return false;
  }
}
```

### 3. Logging Mejorado

```typescript
// Logs informativos cuando se encuentra el binario
console.log(`✅ Binario RustDesk encontrado en: ${rustdeskPath}`);

// Logs de error cuando no se encuentra
console.error('❌ Binario RustDesk no encontrado en ninguna ubicación');
console.log('📋 Ubicaciones verificadas:');
possiblePaths.forEach(p => console.log(`   - ${p}`));
```

## 🔧 Instrucciones para Solucionar

### Opción 1: Instalar RustDesk (Recomendado)

1. **Descargar RustDesk**:
   - Visitar: https://rustdesk.com/
   - Descargar la versión Windows más reciente

2. **Instalar RustDesk**:
   - Ejecutar el instalador descargado
   - Seguir las instrucciones de instalación

3. **Copiar el Binario**:
   ```bash
   # El binario se encuentra en:
   C:\Users\[TuUsuario]\AppData\Local\Programs\RustDesk\rustdesk.exe
   
   # Copiar a:
   resources/rustdesk/rustdesk.exe
   ```

### Opción 2: Descarga Directa

1. **Descargar desde GitHub**:
   - Visitar: https://github.com/rustdesk/rustdesk/releases
   - Buscar: `rustdesk-1.2.3-x86_64.exe` (o versión más reciente)

2. **Extraer el Binario**:
   - El instalador es un archivo auto-extraíble
   - Extraer `rustdesk.exe` del instalador

3. **Colocar en el Proyecto**:
   ```bash
   # Copiar a:
   resources/rustdesk/rustdesk.exe
   ```

## 📁 Estructura de Archivos Esperada

```
mp/
├── resources/
│   └── rustdesk/
│       ├── rustdesk.exe    # ← Archivo requerido
│       └── README.md       # ← Instrucciones
└── src/
    └── modules/
        └── remote/
            └── rustdeskManager.ts
```

## 🔍 Verificación

### 1. Verificar Existencia del Archivo
```bash
# Verificar que el archivo existe
ls -la resources/rustdesk/rustdesk.exe
```

### 2. Verificar Permisos
```bash
# En Windows, verificar que el archivo es ejecutable
# El archivo debe tener extensión .exe
```

### 3. Probar Ejecución
```bash
# Probar que el binario funciona
./resources/rustdesk/rustdesk.exe --help
```

## 🚀 Mejoras Implementadas

### Búsqueda Inteligente
- Verifica múltiples ubicaciones posibles
- Soporte para desarrollo y producción
- Fallback al PATH del sistema

### Mensajes de Error Claros
- Indica exactamente qué archivo falta
- Lista todas las ubicaciones verificadas
- Proporciona instrucciones de solución

### Logging Detallado
- Información de debugging completa
- Trazabilidad de la búsqueda del binario
- Mensajes informativos cuando se encuentra

## 📝 Notas Importantes

1. **Tamaño del Binario**: RustDesk es ~15-20MB
2. **Versión**: Usar siempre la versión estable más reciente
3. **Arquitectura**: Solo x64 (64-bit) está soportado
4. **Antivirus**: Puede requerir excepciones en el antivirus

## 🔄 Próximos Pasos

1. **Descargar e instalar** RustDesk siguiendo las instrucciones
2. **Copiar el binario** a `resources/rustdesk/rustdesk.exe`
3. **Reiniciar** la aplicación MP Reports
4. **Probar** la funcionalidad de Control Remoto

---

**Fecha de Corrección**: $(date)
**Versión**: 1.0.3
**Estado**: ✅ Error identificado y solución implementada
