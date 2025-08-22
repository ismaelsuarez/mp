# MÓDULO DE CONTROL REMOTO RUSTDESK

## Descripción General

El módulo de control remoto integra RustDesk en la aplicación MP Reports, permitiendo control remoto de todas las sucursales desde una interfaz centralizada. Cada instalación puede configurarse como **Host (Puesto)** o **Viewer (Jefe)**.

## Arquitectura

### Componentes Principales

1. **RustDeskManager**: Gestión de procesos binarios de RustDesk
2. **ServerSync**: Sincronización con servidor VPS RustDesk
3. **RemoteService**: Servicio principal de orquestación
4. **Interfaz de Usuario**: Configuración y control desde Modo Administrador

### Flujo de Trabajo

```
[Puesto] → Configura Host → Se registra en VPS → Disponible para control
[Jefe] → Configura Viewer → Consulta VPS → Lista sucursales → Conecta
```

## Configuración del Servidor VPS

### Requisitos del Servidor

- **Sistema**: Ubuntu 20.04+ / CentOS 8+ / Debian 11+
- **Puertos**: 21115 (hbbs), 21116 (hbbr), 21117 (hbbr)
- **Recursos**: 1GB RAM, 10GB disco

### Instalación del Servidor

```bash
# Descargar binarios RustDesk Server
wget https://github.com/rustdesk/rustdesk-server/releases/latest/download/rustdesk-server-linux-x64.zip
unzip rustdesk-server-linux-x64.zip

# Configurar hbbs (ID Server)
./hbbs -r [RELAY_SERVER_IP]:21117 -k _

# Configurar hbbr (Relay Server)
./hbbr -k _
```

### Configuración de Firewall

```bash
# Abrir puertos necesarios
sudo ufw allow 21115/tcp
sudo ufw allow 21116/tcp
sudo ufw allow 21117/tcp
```

## Configuración en MP Reports

### Variables de Entorno

Agregar al archivo `.env`:

```env
# Control Remoto RustDesk
REMOTE_ID_SERVER=tu-vps.com:21115
REMOTE_RELAY_SERVER=tu-vps.com:21116
ENCRYPTION_KEY=tu-clave-secreta-muy-segura
```

### Configuración de Binarios

1. Crear directorio `resources/rustdesk/`
2. Descargar binarios desde [RustDesk Releases](https://github.com/rustdesk/rustdesk/releases)
3. Copiar el ejecutable principal:
   - `rustdesk.exe` → `resources/rustdesk/rustdesk.exe`

### Configuración de Build

Actualizar `package.json`:

```json
{
  "build": {
    "extraResources": [
      {
        "from": "resources/rustdesk",
        "to": "resources/rustdesk",
        "filter": ["**/*"]
      }
    ]
  }
}
```

## Uso del Módulo

### Configuración como Host (Puesto)

1. **Acceder a Administración** → **Control Remoto**
2. **Seleccionar Rol**: "Host (Puesto)"
3. **Configurar servidores**:
   - Servidor ID: `tu-vps.com:21115`
   - Servidor Relay: `tu-vps.com:21116`
4. **Configurar credenciales**:
   - Usuario: `puesto1`
   - Contraseña: `1234`
5. **Activar auto-start** (opcional)
6. **Guardar y Activar**

### Configuración como Viewer (Jefe)

1. **Acceder a Administración** → **Control Remoto**
2. **Seleccionar Rol**: "Viewer (Jefe)"
3. **Configurar servidores** (mismos que Host)
4. **Guardar configuración**
5. **Ver lista de sucursales disponibles**
6. **Hacer clic en "Conectar"** para controlar

## Funcionalidades

### Para Hosts (Puestos)

- ✅ **Registro automático** en servidor VPS
- ✅ **Inicio automático** al arrancar (opcional)
- ✅ **Gestión de credenciales** encriptadas
- ✅ **Monitoreo de estado** del proceso

### Para Viewers (Jefes)

- ✅ **Lista de sucursales** en tiempo real
- ✅ **Estado online/offline** de cada puesto
- ✅ **Conexión directa** con un clic
- ✅ **Control remoto completo** integrado

### Seguridad

- ✅ **Encriptación AES-256** de credenciales
- ✅ **Autenticación** requerida para acceso
- ✅ **Validación** de entrada de datos
- ✅ **Logs** de todas las conexiones

## API del Módulo

### Endpoints IPC

```typescript
// Configuración
'remote:saveConfig'     // Guardar configuración
'remote:getConfig'      // Obtener configuración actual

// Control de procesos
'remote:startHost'      // Iniciar proceso Host
'remote:startViewer'    // Iniciar Viewer para conectar
'remote:stopHost'       // Detener proceso Host
'remote:stopViewer'     // Detener proceso Viewer

// Consultas
'remote:getOnlineHosts' // Lista de hosts disponibles
'remote:pingServer'     // Verificar conectividad con VPS
```

### Ejemplo de Uso

```typescript
// Guardar configuración
const config = {
  role: 'host',
  idServer: 'mi-vps.com:21115',
  relayServer: 'mi-vps.com:21116',
  username: 'puesto1',
  password: '1234',
  autoStart: true
};

const result = await window.api.remote.saveConfig(config);

// Obtener hosts online
const hosts = await window.api.remote.getOnlineHosts();

// Conectar a un host
await window.api.remote.startViewer('host-id-123');
```

## Troubleshooting

### Problemas Comunes

#### 1. Host no se registra en VPS

**Síntomas**: Host no aparece en lista de sucursales
**Solución**:
- Verificar conectividad con VPS
- Revisar logs de RustDesk
- Confirmar configuración de servidores

#### 2. Viewer no puede conectar

**Síntomas**: Error al intentar conectar
**Solución**:
- Verificar que Host esté online
- Confirmar credenciales correctas
- Revisar firewall del Host

#### 3. Proceso no inicia

**Síntomas**: Error al iniciar RustDesk
**Solución**:
- Verificar binarios en `resources/rustdesk/`
- Confirmar permisos de ejecución
- Revisar antivirus (puede bloquear)

### Logs y Debugging

Los logs se registran en:
- **Consola de Electron**: Errores generales
- **stdout/stderr**: Output de procesos RustDesk
- **Base de datos**: Configuración y estado

### Comandos de Diagnóstico

```bash
# Verificar conectividad con VPS
curl http://tu-vps.com:21115/ping

# Verificar procesos activos
tasklist | findstr rustdesk

# Verificar puertos abiertos
netstat -an | findstr 21115
```

## Mantenimiento

### Actualización de Binarios

1. Descargar nueva versión de RustDesk
2. Reemplazar archivos en `resources/rustdesk/`
3. Reconstruir aplicación
4. Probar conectividad

### Limpieza de Datos

```typescript
// Limpiar configuración
await window.api.remote.clearConfig();

// Detener todos los procesos
await window.api.remote.stopAll();
```

### Backup de Configuración

La configuración se almacena en:
- **SQLite**: `userData/remote_config.db`
- **Encriptado**: Credenciales protegidas
- **Automático**: Backup con sistema existente

## Roadmap

### Versión 1.0 (Actual)
- ✅ Configuración básica Host/Viewer
- ✅ Integración con servidor VPS
- ✅ Interfaz de administración
- ✅ Seguridad básica

### Versión 1.1 (Próxima)
- 🔄 **Ventana embebida** para control remoto
- 🔄 **Notificaciones** de conexiones
- 🔄 **Historial** de sesiones
- 🔄 **Configuración avanzada** de servidor

### Versión 1.2 (Futura)
- 📋 **Control masivo** de múltiples puestos
- 📋 **Scripts automáticos** de mantenimiento
- 📋 **Reportes** de uso y estadísticas
- 📋 **Integración** con sistema de alertas

## Soporte

### Recursos Adicionales

- [Documentación RustDesk](https://rustdesk.com/docs/)
- [Servidor RustDesk](https://github.com/rustdesk/rustdesk-server)
- [API de RustDesk](https://github.com/rustdesk/rustdesk-server/wiki/API)

### Contacto

Para soporte técnico del módulo:
- **Issues**: Crear en repositorio del proyecto
- **Documentación**: Ver `docs/doc_control_remoto/`
- **Logs**: Revisar consola de Electron

---

**Versión**: 1.0  
**Fecha**: Diciembre 2024  
**Compatibilidad**: MP Reports 1.0+
