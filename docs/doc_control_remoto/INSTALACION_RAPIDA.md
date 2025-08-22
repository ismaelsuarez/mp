# INSTALACIÓN RÁPIDA - MÓDULO CONTROL REMOTO

## Requisitos Previos

- **VPS Linux** (Ubuntu 20.04+, CentOS 8+, Debian 11+)
- **1GB RAM mínimo**
- **10GB disco libre**
- **Puertos abiertos**: 21115, 21116, 21117

## Paso 1: Configurar Servidor VPS

### Opción A: Script Automático (Recomendado)

```bash
# Descargar script de configuración
wget https://raw.githubusercontent.com/tu-usuario/mp-reports/main/scripts/setup-rustdesk-server.sh
chmod +x setup-rustdesk-server.sh
sudo ./setup-rustdesk-server.sh
```

### Opción B: Configuración Manual

```bash
# 1. Crear directorio
sudo mkdir -p /opt/rustdesk-server
cd /opt/rustdesk-server

# 2. Descargar RustDesk Server
wget https://github.com/rustdesk/rustdesk-server/releases/latest/download/rustdesk-server-linux-x64.zip
unzip rustdesk-server-linux-x64.zip
chmod +x hbbs hbbr

# 3. Generar claves
./hbbs --gen-key

# 4. Configurar hbbs
./hbbs -r [RELAY_SERVER_IP]:21117 -k _

# 5. Configurar hbbr
./hbbr -k _

# 6. Abrir puertos en firewall
sudo ufw allow 21115/tcp
sudo ufw allow 21116/tcp
sudo ufw allow 21117/tcp
```

## Paso 2: Configurar MP Reports

### 1. Descargar Binario RustDesk

```bash
# Crear directorio de recursos
mkdir -p resources/rustdesk

# Descargar desde releases oficiales
# https://github.com/rustdesk/rustdesk/releases
# Copiar rustdesk.exe a resources/rustdesk/
```

### 2. Actualizar Variables de Entorno

Agregar al archivo `.env`:

```env
# Control Remoto RustDesk
REMOTE_ID_SERVER=tu-vps.com:21115
REMOTE_RELAY_SERVER=tu-vps.com:21116
ENCRYPTION_KEY=tu-clave-secreta-muy-segura
```

### 3. Actualizar package.json

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

## Paso 3: Verificar Instalación

### Verificar Servidor

```bash
# Verificar servicios
systemctl status rustdesk-hbbs
systemctl status rustdesk-hbbr

# Verificar puertos
netstat -tlnp | grep -E '21115|21116|21117'

# Verificar logs
journalctl -u rustdesk-hbbs -f
journalctl -u rustdesk-hbbr -f
```

### Verificar Cliente

```bash
# Probar conectividad
curl http://tu-vps.com:21115/ping

# Verificar binario
ls -la resources/rustdesk/rustdesk.exe
```

## Paso 4: Configurar en MP Reports

### Como Host (Puesto)

1. Abrir **Administración** → **Control Remoto**
2. Seleccionar **Rol**: "Host (Puesto)"
3. Configurar:
   - **Servidor ID**: `tu-vps.com:21115`
   - **Servidor Relay**: `tu-vps.com:21116`
   - **Usuario**: `puesto1`
   - **Contraseña**: `1234`
4. Activar **Auto-start**
5. **Guardar y Activar**

### Como Viewer (Jefe)

1. Abrir **Administración** → **Control Remoto**
2. Seleccionar **Rol**: "Viewer (Jefe)"
3. Configurar servidores (mismos que Host)
4. **Guardar configuración**
5. Ver lista de sucursales disponibles

## Troubleshooting

### Problemas Comunes

#### Servidor no responde
```bash
# Verificar servicios
systemctl restart rustdesk-hbbs rustdesk-hbbr

# Verificar firewall
sudo ufw status
```

#### Cliente no conecta
```bash
# Verificar binario
file resources/rustdesk/rustdesk.exe

# Verificar permisos
chmod +x resources/rustdesk/rustdesk.exe
```

#### Host no aparece en lista
- Verificar que Host esté configurado y activo
- Revisar logs del servidor
- Confirmar conectividad de red

## Comandos Útiles

```bash
# Reiniciar servicios
sudo systemctl restart rustdesk-hbbs rustdesk-hbbr

# Ver logs en tiempo real
journalctl -u rustdesk-hbbs -f
journalctl -u rustdesk-hbbr -f

# Verificar puertos
netstat -tlnp | grep rustdesk

# Backup configuración
cp /opt/rustdesk-server/*.toml /backup/
```

## Recursos Adicionales

- [Repositorio RustDesk](https://github.com/rustdesk/rustdesk)
- [RustDesk Server](https://github.com/rustdesk/rustdesk-server)
- [Documentación Oficial](https://rustdesk.com/docs/)

---

**Nota**: Esta guía está basada en la documentación oficial de RustDesk y adaptada para MP Reports.
