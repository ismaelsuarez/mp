# Configuración de Build para Windows

## Configuración Actualizada

El proyecto está configurado para generar dos versiones de la aplicación:

### 1. Instalador NSIS (x64)
- **Ubicación**: `dist/Tc-Mp ver.1.0.1.exe`
- **Características**:
  - Instalación para todos los usuarios (`perMachine: true`)
  - Opción de cambiar directorio de instalación
  - Instalación no automática (no one-click)
  - Crea accesos directos en escritorio y menú inicio

### 2. Ejecutable Portable (x64)
- **Ubicación**: `dist/Tc-Mp ver.1.0.1.exe` (con sufijo portable)
- **Características**:
  - No requiere instalación
  - Ejecutable independiente
  - Ideal para uso en USB o carpetas temporales

## Configuración Técnica

### Sin Compresión Agresiva
- `"compression": "store"` - Sin compresión para evitar falsos positivos en antivirus
- No se usa UPX ni otros empaquetadores agresivos

### Sin ASAR
- `"asar": false` - Los archivos no se empaquetan en formato ASAR
- Evita falsos positivos en software antivirus
- Facilita la depuración y mantenimiento

### Arquitectura
- Solo se genera para x64 (64-bit)
- Compatible con Windows 10/11

## Comandos de Build

```bash
# Build completo (TypeScript + Electron Builder)
npm run build

# Solo compilar TypeScript
npm run build:ts

# Solo generar ejecutables (requiere TypeScript compilado)
electron-builder -w
```

## Ubicación de Archivos Generados

Los ejecutables se generan en el directorio `dist/` con los siguientes nombres:

- **Instalador NSIS**: `Tc-Mp ver.1.0.1.exe`
- **Portable**: `Tc-Mp ver.1.0.1.exe` (versión portable)

## Configuración NSIS

- **Instalación para todos los usuarios**: Sí
- **Permitir cambiar directorio**: Sí
- **Instalación automática**: No (requiere interacción del usuario)
- **Accesos directos**: Escritorio y menú inicio

## Dependencias Incluidas

La configuración mantiene todas las dependencias necesarias:
- Archivos fuente compilados (`dist/**/*`)
- Recursos públicos (`public/**/*`)
- SDK de Mercado Pago (`mp-sdk/**/*`)
- Archivos de configuración (`package.json`)

## Notas de Seguridad

- No se usa compresión agresiva para evitar detecciones falsas
- Archivos no empaquetados en ASAR para mayor transparencia
- Configuración compatible con software antivirus empresarial
