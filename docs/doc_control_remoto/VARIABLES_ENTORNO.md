# VARIABLES DE ENTORNO - CONTROL REMOTO

## Configuración Requerida

Para que el módulo de Control Remoto funcione correctamente, necesitas agregar las siguientes variables al archivo `.env` en la raíz del proyecto:

### Variables Obligatorias

```env
# Control Remoto RustDesk
# ========================

# Servidor ID (hbbs) - Puerto por defecto 21115
REMOTE_ID_SERVER=tu-servidor.com:21115

# Servidor Relay (hbbr) - Puerto por defecto 21116  
REMOTE_RELAY_SERVER=tu-servidor.com:21116

# Clave de encriptación para credenciales de control remoto
# IMPORTANTE: Cambiar por una clave segura y única de al menos 32 caracteres
ENCRYPTION_KEY=mi-clave-super-secreta-para-encriptar-credenciales-remotas-2024
```

### Ejemplo Completo

```env
# MP Reports - Configuración Completa
# ===================================

# MercadoPago (ya existente)
MP_ACCESS_TOKEN=tu-token-mercadopago
MP_USER_ID=tu-user-id-mercadopago

# Control Remoto RustDesk (NUEVO)
REMOTE_ID_SERVER=mi-servidor-rustdesk.com:21115
REMOTE_RELAY_SERVER=mi-servidor-rustdesk.com:21116
ENCRYPTION_KEY=clave-de-encriptacion-muy-segura-y-unica-32-chars-min

# Email SMTP (ya existente)
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=mi-email@empresa.com
SMTP_PASS=mi-password-de-aplicacion

# FTP (ya existente)
FTP_HOST=mi-servidor-ftp.com
FTP_PORT=21
FTP_USER=mi-usuario-ftp
FTP_PASS=mi-password-ftp

# Desarrollo (opcional)
NODE_ENV=production
DEBUG=false
```

## Instrucciones de Configuración

### 1. Crear/Editar archivo .env

Si no existe el archivo `.env` en la raíz del proyecto, créalo:

```bash
# En la raíz del proyecto MP Reports
touch .env
```

### 2. Agregar Variables RustDesk

Agrega estas líneas al archivo `.env`:

```env
# Control Remoto RustDesk
REMOTE_ID_SERVER=TU_SERVIDOR:21115
REMOTE_RELAY_SERVER=TU_SERVIDOR:21116
ENCRYPTION_KEY=TU_CLAVE_SECRETA_UNICA
```

### 3. Reemplazar Valores

- **REMOTE_ID_SERVER**: Dirección IP o dominio de tu servidor VPS donde está ejecutándose `hbbs`
- **REMOTE_RELAY_SERVER**: Dirección IP o dominio de tu servidor VPS donde está ejecutándose `hbbr`
- **ENCRYPTION_KEY**: Una clave secreta única para encriptar las credenciales de los hosts

### 4. Ejemplo Real

```env
# Ejemplo con servidor VPS real
REMOTE_ID_SERVER=192.168.1.100:21115
REMOTE_RELAY_SERVER=192.168.1.100:21116
ENCRYPTION_KEY=MiClaveSegura2024ParaEncriptarCredencialesRemotas!
```

## Seguridad

### ⚠️ **IMPORTANTE**

1. **Nunca compartir el archivo .env**: Este archivo contiene credenciales sensibles
2. **Clave de encriptación única**: Usar una clave diferente para cada instalación
3. **Longitud mínima**: La clave debe tener al menos 32 caracteres
4. **Caracteres seguros**: Usar letras, números y símbolos

### Generar Clave Segura

Puedes generar una clave segura usando:

```bash
# Linux/macOS
openssl rand -base64 32

# Windows PowerShell
[System.Convert]::ToBase64String((1..32 | ForEach {Get-Random -Maximum 256}))

# Online (usar con precaución)
# https://passwordsgenerator.net/
```

## Verificación

Para verificar que las variables están configuradas correctamente:

1. Abre **MP Reports**
2. Ve a **Administración** → **Control Remoto**
3. Los campos de servidor deberían llenarse automáticamente
4. Haz clic en **"🔗 Probar Conexión"** para verificar conectividad

## Troubleshooting

### Error: "Variables de entorno no encontradas"

- Verificar que el archivo `.env` existe en la raíz del proyecto
- Verificar que las variables están escritas correctamente (sin espacios extra)
- Reiniciar la aplicación después de modificar `.env`

### Error: "Servidor no responde"

- Verificar que el servidor VPS está ejecutándose
- Verificar que los puertos 21115 y 21116 están abiertos
- Verificar que la dirección IP/dominio es correcta

### Error de encriptación

- Verificar que `ENCRYPTION_KEY` tiene al menos 32 caracteres
- Usar solo caracteres ASCII en la clave
- Reiniciar la aplicación después de cambiar la clave

---

**Nota**: Estas variables son leídas automáticamente al iniciar la aplicación. Cualquier cambio requiere reiniciar MP Reports para tomar efecto.
