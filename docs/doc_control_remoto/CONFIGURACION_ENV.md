# Configuración de Variables de Entorno - Control Remoto

## 🎯 Objetivo

Configurar las variables de entorno necesarias para el módulo de Control Remoto RustDesk en el archivo `.env`.

## 📋 Variables Requeridas

### 1. Servidores RustDesk

```bash
# Servidor ID (hbbs) - Puerto por defecto 21115
REMOTE_ID_SERVER=149.50.150.15:21115

# Servidor Relay (hbbr) - Puerto por defecto 21116  
REMOTE_RELAY_SERVER=149.50.150.15:21116
```

### 2. Clave de Encriptación

```bash
# Clave de encriptación para credenciales de control remoto
# IMPORTANTE: Cambiar por una clave segura y única de al menos 32 caracteres
ENCRYPTION_KEY=mp-reports-remote-control-secure-key-2024
```

## 🔧 Pasos de Configuración

### Paso 1: Crear Archivo .env

1. **Copiar el archivo de ejemplo**:
   ```bash
   cp env.example .env
   ```

2. **Editar el archivo .env** con tus valores:
   ```bash
   # Usar un editor de texto
   notepad .env
   ```

### Paso 2: Configurar Variables

#### Servidores RustDesk
```bash
# Configurar con tu servidor VPS
REMOTE_ID_SERVER=149.50.150.15:21115
REMOTE_RELAY_SERVER=149.50.150.15:21116
```

#### Clave de Encriptación
```bash
# Generar una clave segura (mínimo 32 caracteres)
ENCRYPTION_KEY=tu-clave-secreta-muy-larga-y-segura-2024
```

### Paso 3: Verificar Configuración

1. **Reiniciar la aplicación** MP Reports
2. **Ir a Configuración** → **Control Remoto**
3. **Verificar** que los campos se llenan automáticamente con los valores del `.env`

## 📁 Estructura del Archivo .env

```bash
# ========================================
# CONFIGURACIÓN CONTROL REMOTO (RUSTDESK)
# ========================================
# Servidor ID (hbbs) - Puerto por defecto 21115
REMOTE_ID_SERVER=149.50.150.15:21115

# Servidor Relay (hbbr) - Puerto por defecto 21116  
REMOTE_RELAY_SERVER=149.50.150.15:21116

# Clave de encriptación para credenciales de control remoto
# IMPORTANTE: Cambiar por una clave segura y única de al menos 32 caracteres
ENCRYPTION_KEY=mp-reports-remote-control-secure-key-2024
```

## 🔒 Seguridad

### Clave de Encriptación

1. **Longitud mínima**: 32 caracteres
2. **Complejidad**: Incluir mayúsculas, minúsculas, números y símbolos
3. **Unicidad**: No reutilizar claves de otros sistemas
4. **Almacenamiento seguro**: No compartir el archivo `.env`

### Ejemplo de Clave Segura

```bash
ENCRYPTION_KEY=MP-Reports-2024-Secure-Remote-Control-Key-!@#$%^&*()
```

## 🔄 Comportamiento del Sistema

### Valores por Defecto

- **Sin configuración guardada**: El sistema usa los valores del `.env`
- **Configuración corrupta**: Se limpia y usa valores del `.env`
- **Error de desencriptación**: Se resetea a valores del `.env`

### Prioridad de Configuración

1. **Configuración guardada en BD** (si existe y es válida)
2. **Variables de entorno** (`.env`)
3. **Valores hardcodeados** (fallback)

## 🚀 Beneficios

### Configuración Centralizada
- Todos los servidores configurados en un lugar
- Fácil cambio de servidores
- Configuración por entorno (desarrollo/producción)

### Seguridad Mejorada
- Credenciales encriptadas con clave configurable
- Separación de configuración sensible
- Fácil rotación de claves

### Flexibilidad
- Configuración por defecto automática
- Fallback robusto
- Sin necesidad de configuración manual inicial

## 🔍 Verificación

### Logs Esperados

```bash
# Al iniciar la aplicación
[RemoteService] Usando configuración por defecto del .env
[ServerSync] Inicializado con ID Server: 149.50.150.15:21115, Relay Server: 149.50.150.15:21116

# Al limpiar configuración corrupta
✅ Configuración corrupta limpiada. Usando valores por defecto del .env.
```

### UI Esperada

- **Campos pre-llenados** con valores del `.env`
- **Sin errores** de configuración
- **Funcionalidad completa** del control remoto

## 📝 Notas Importantes

1. **Archivo .env**: No se incluye en el control de versiones (`.gitignore`)
2. **Variables requeridas**: Todas las variables deben estar configuradas
3. **Reinicio necesario**: Cambios en `.env` requieren reiniciar la aplicación
4. **Backup**: Mantener copia de seguridad del archivo `.env`

## 🔄 Próximos Pasos

1. **Crear archivo .env** con las variables configuradas
2. **Reiniciar** la aplicación MP Reports
3. **Verificar** que el control remoto funciona correctamente
4. **Probar** conexión al servidor RustDesk

---

**Fecha de Creación**: $(date)
**Versión**: 1.0.0
**Estado**: ✅ Documentación completa
