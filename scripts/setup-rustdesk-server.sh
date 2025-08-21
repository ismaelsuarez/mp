#!/bin/bash

# Script de configuración del servidor RustDesk para MP Reports
# Basado en la documentación oficial: https://github.com/rustdesk/rustdesk-server

echo "=== Configuración del Servidor RustDesk para MP Reports ==="

# Verificar sistema operativo
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    echo "✅ Sistema Linux detectado"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    echo "❌ macOS no soportado para servidor"
    exit 1
else
    echo "❌ Sistema operativo no soportado"
    exit 1
fi

# Crear directorio de trabajo
mkdir -p /opt/rustdesk-server
cd /opt/rustdesk-server

echo "📥 Descargando RustDesk Server..."

# Descargar la última versión
wget -O rustdesk-server.zip "https://github.com/rustdesk/rustdesk-server/releases/latest/download/rustdesk-server-linux-x64.zip"

if [ $? -ne 0 ]; then
    echo "❌ Error descargando RustDesk Server"
    exit 1
fi

# Extraer archivos
unzip -o rustdesk-server.zip
chmod +x hbbs hbbr

echo "🔧 Configurando servicios..."

# Crear archivo de configuración para hbbs
cat > hbbs-config.toml << EOF
# Configuración del servidor ID (hbbs)
[hbbs]
# Puerto para el servidor ID
port = 21115
# Puerto para el servidor relay
relay_port = 21116
# Clave pública (generar con: ./hbbs --gen-key)
public_key = ""
# Clave privada (generar con: ./hbbs --gen-key)
private_key = ""
EOF

# Crear archivo de configuración para hbbr
cat > hbbr-config.toml << EOF
# Configuración del servidor relay (hbbr)
[hbbr]
# Puerto para el servidor relay
port = 21117
# Clave pública (misma que hbbs)
public_key = ""
# Clave privada (misma que hbbs)
private_key = ""
EOF

# Generar claves si no existen
if [ ! -f "id_ed25519" ]; then
    echo "🔑 Generando claves de seguridad..."
    ./hbbs --gen-key
    mv id_ed25519.pub public_key.txt
    mv id_ed25519 private_key.txt
fi

# Actualizar configuraciones con las claves generadas
if [ -f "public_key.txt" ] && [ -f "private_key.txt" ]; then
    PUBLIC_KEY=$(cat public_key.txt)
    PRIVATE_KEY=$(cat private_key.txt)
    
    sed -i "s/public_key = \"\"/public_key = \"$PUBLIC_KEY\"/" hbbs-config.toml
    sed -i "s/private_key = \"\"/private_key = \"$PRIVATE_KEY\"/" hbbs-config.toml
    
    sed -i "s/public_key = \"\"/public_key = \"$PUBLIC_KEY\"/" hbbr-config.toml
    sed -i "s/private_key = \"\"/private_key = \"$PRIVATE_KEY\"/" hbbr-config.toml
fi

# Crear servicios systemd
echo "📋 Creando servicios systemd..."

cat > /etc/systemd/system/rustdesk-hbbs.service << EOF
[Unit]
Description=RustDesk ID Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rustdesk-server
ExecStart=/opt/rustdesk-server/hbbs --config hbbs-config.toml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

cat > /etc/systemd/system/rustdesk-hbbr.service << EOF
[Unit]
Description=RustDesk Relay Server
After=network.target

[Service]
Type=simple
User=root
WorkingDirectory=/opt/rustdesk-server
ExecStart=/opt/rustdesk-server/hbbr --config hbbr-config.toml
Restart=always
RestartSec=10

[Install]
WantedBy=multi-user.target
EOF

# Configurar firewall
echo "🔥 Configurando firewall..."

if command -v ufw &> /dev/null; then
    ufw allow 21115/tcp
    ufw allow 21116/tcp
    ufw allow 21117/tcp
    echo "✅ Puertos abiertos en UFW"
elif command -v firewall-cmd &> /dev/null; then
    firewall-cmd --permanent --add-port=21115/tcp
    firewall-cmd --permanent --add-port=21116/tcp
    firewall-cmd --permanent --add-port=21117/tcp
    firewall-cmd --reload
    echo "✅ Puertos abiertos en firewalld"
else
    echo "⚠️  No se detectó firewall, abrir puertos manualmente: 21115, 21116, 21117"
fi

# Habilitar y iniciar servicios
echo "🚀 Iniciando servicios..."

systemctl daemon-reload
systemctl enable rustdesk-hbbs
systemctl enable rustdesk-hbbr
systemctl start rustdesk-hbbs
systemctl start rustdesk-hbbr

# Verificar estado
echo "📊 Verificando estado de servicios..."

if systemctl is-active --quiet rustdesk-hbbs; then
    echo "✅ hbbs (ID Server) - ACTIVO"
else
    echo "❌ hbbs (ID Server) - ERROR"
fi

if systemctl is-active --quiet rustdesk-hbbr; then
    echo "✅ hbbr (Relay Server) - ACTIVO"
else
    echo "❌ hbbr (Relay Server) - ERROR"
fi

# Mostrar información de configuración
echo ""
echo "=== CONFIGURACIÓN COMPLETADA ==="
echo ""
echo "📋 Información para MP Reports:"
echo "   Servidor ID: $(hostname -I | awk '{print $1}'):21115"
echo "   Servidor Relay: $(hostname -I | awk '{print $1}'):21116"
echo ""
echo "🔑 Clave pública (para clientes):"
if [ -f "public_key.txt" ]; then
    cat public_key.txt
else
    echo "   No se generó clave pública"
fi
echo ""
echo "📁 Archivos de configuración:"
echo "   hbbs: /opt/rustdesk-server/hbbs-config.toml"
echo "   hbbr: /opt/rustdesk-server/hbbr-config.toml"
echo ""
echo "🔧 Comandos útiles:"
echo "   Ver logs: journalctl -u rustdesk-hbbs -f"
echo "   Ver logs: journalctl -u rustdesk-hbbr -f"
echo "   Reiniciar: systemctl restart rustdesk-hbbs rustdesk-hbbr"
echo "   Detener: systemctl stop rustdesk-hbbs rustdesk-hbbr"
echo ""
echo "✅ Instalación completada exitosamente!"
