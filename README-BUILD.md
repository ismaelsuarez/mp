# Guía de Build - Tc-Mp

## Configuración Actualizada para Windows

Este proyecto está configurado para generar dos versiones de la aplicación con las siguientes características de seguridad y compatibilidad:

### 🛡️ Características de Seguridad
- **Sin compresión agresiva**: `compression: "store"` para evitar falsos positivos en antivirus
- **Sin ASAR**: `asar: false` para mayor transparencia y compatibilidad
- **Sin UPX**: No se usan empaquetadores agresivos

### 📦 Versiones Generadas

#### 1. Instalador NSIS (x64)
- **Ubicación**: `dist/Tc-Mp ver.1.0.1.exe`
- **Características**:
  - Instalación para todos los usuarios (`perMachine: true`)
  - Opción de cambiar directorio de instalación
  - Instalación no automática (requiere interacción del usuario)
  - Crea accesos directos en escritorio y menú inicio

#### 2. Ejecutable Portable (x64)
- **Ubicación**: `dist/Tc-Mp ver.1.0.1.exe` (versión portable)
- **Características**:
  - No requiere instalación
  - Ejecutable independiente
  - Ideal para uso en USB o carpetas temporales

## 🚀 Comandos de Build

### Build Completo (Recomendado)
```bash
npm run build:windows
```
Este comando:
1. Verifica que estés en Windows
2. Compila TypeScript
3. Genera ambos ejecutables
4. Muestra información detallada del proceso

### Build Manual
```bash
# Solo compilar TypeScript
npm run build:ts

# Solo generar ejecutables (requiere TypeScript compilado)
npm run build
```

## 📁 Ubicación de Archivos

### Archivos de Configuración
- **Icono**: `build/icon.ico` (requerido)
- **Configuración NSIS**: `build/installer.nsh` (opcional)

### Archivos Generados
- **Directorio**: `dist/`
- **Instalador**: `Tc-Mp ver.1.0.1.exe`
- **Portable**: `Tc-Mp ver.1.0.1.exe` (versión portable)

## ⚙️ Configuración Técnica

### package.json - Sección "build"
```json
{
  "build": {
    "appId": "com.todo.tc-mp",
    "productName": "Tc-Mp",
    "asar": false,
    "compression": "store",
    "win": {
      "target": [
        { "target": "nsis", "arch": ["x64"] },
        { "target": "portable", "arch": ["x64"] }
      ],
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": true,
      "allowToChangeInstallationDirectory": true
    }
  }
}
```

### Archivos Incluidos
- `src/**/*` - Código fuente
- `public/**/*` - Recursos públicos
- `mp-sdk/**/*` - SDK de Mercado Pago
- `dist/**/*` - Archivos compilados
- `package.json` - Configuración

## 🔧 Requisitos

### Sistema
- Windows 10/11 x64
- Node.js 18+ (recomendado LTS)
- npm o yarn

### Dependencias
```bash
npm install
```

### Archivos Requeridos
- `build/icon.ico` - Icono de la aplicación (199KB, multiresolución)

## 🐛 Solución de Problemas

### Error: "No se encontró build/icon.ico"
```bash
# Verificar que el icono existe
ls build/icon.ico
```

### Error: "Application entry file does not exist"
```bash
# Compilar TypeScript primero
npm run build:ts
```

### Error: "Break signaled" durante NSIS
```bash
# Limpiar y reintentar
rmdir /s /q dist
npm run build:windows
```

### Antivirus bloquea la compilación
1. Desactivar temporalmente el antivirus
2. Agregar `dist/` a las exclusiones
3. Ejecutar como administrador

## 📋 Verificación Post-Build

1. **Probar instalador NSIS**:
   - Ejecutar como administrador
   - Verificar instalación en directorio elegido
   - Comprobar accesos directos

2. **Probar ejecutable portable**:
   - Copiar a USB o carpeta temporal
   - Verificar funcionamiento independiente

3. **Verificar funcionalidad**:
   - Configurar credenciales
   - Probar conexión con Mercado Pago
   - Generar reportes

## 🔄 Actualización de Versión

Para actualizar la versión:

1. Editar `package.json`:
   ```json
   {
     "version": "1.0.2",
     "build": {
       "artifactName": "Tc-Mp ver.${version}.${ext}"
     }
   }
   ```

2. Regenerar ejecutables:
   ```bash
   npm run build:windows
   ```

## 📞 Soporte

Para problemas específicos del build:
1. Verificar logs en consola
2. Revisar `BUILD-WINDOWS.md`
3. Comprobar configuración en `package.json`
