## CONFIG – FTP

### Objetivo
Transferir automáticamente `mp.dbf` y evitar reenvíos innecesarios.

### Campos (Cliente FTP saliente)
- IP/Host y Puerto (21 por defecto)
- FTPS (explícito)
- Usuario / Contraseña
- Carpeta remota / Archivo remoto (DBF)

### Acciones (Cliente FTP)
- Probar FTP
- Enviar DBF por FTP
- Limpiar Hash FTP

### Comportamiento
- Envío automático tras generación: enviado / sin cambios / error

### Diferencia: Cliente FTP vs Servidor FTP
- **Cliente FTP (saliente)**: es la app conectándose a otro servidor. Aquí sí existen intervalos/automatización (según la configuración de "Automatización"), reintentos y lógica de no reenviar.
- **Servidor FTP integrado (entrante)**: la app actúa como servidor y **no tiene intervalos**. Simplemente queda escuchando en el puerto configurado y atiende conexiones cuando un tercero envía archivos.

### FTP Server integrado (opcional)
- Permite exponer una carpeta local como servidor FTP dentro de la misma app.
- Configurable en Admin → “FTP Server”.
- Campos: Host (0.0.0.0= todas las IPs), Puerto (por defecto 2121), Usuario/Contraseña, Carpeta raíz, Habilitado (autoarranque).
- PASV (recomendado si hay firewall/NAT/Internet):
  - PASV Host: IP LAN (para clientes internos) o IP pública (para clientes externos)
  - PASV Range: rango de puertos de datos, sugerido 50000–50100
  - Abrir en firewall/router: TCP 21 y el rango PASV definido
- Botón “Iniciar/Detener servidor FTP”. Muestra URL y raíz.
- Requiere que el puerto elegido esté libre (p.ej. si usas 21, desactiva IIS/FileZilla) y que el firewall permita 21 y el rango PASV configurado.

#### Rendimiento / Latencia percibida
- El **servidor no introduce esperas programadas**: acepta conexiones tan pronto como el sistema operativo las entrega.
- Diferencias respecto a otros servidores (p.ej. FileZilla Server) pueden deberse a:
  - Resolución de **PASV** (si no se anuncia `PASV Host`, algunos clientes demoran o fallan la apertura del canal de datos).
  - **Firewall/AV** inspeccionando la conexión o el archivo (especialmente con archivos grandes o muchas conexiones).
  - **Modo del cliente** (Active vs PASV) y red/NAT: usar PASV.
  - **Rendimiento de disco** o antivirus sobre la carpeta raíz.
- Recomendaciones para respuestas más rápidas:
  - Definir `PASV Host` y un rango (p.ej. 50000–50100) y abrirlos en firewall/router.
  - Usar **PASV** en el cliente y credenciales válidas.
  - Carpeta raíz en disco local (ideal SSD) y excluirla del antivirus si es seguro.
  - Evitar herramientas que usen el Explorador de Windows como cliente para grandes volúmenes; preferir FileZilla/WinSCP/curl.

### Referencias
- Cliente: `src/services/FtpService.ts`
- Server: `src/services/FtpServerService.ts`, IPC en `src/main.ts`, UI en `public/config.html` y `src/renderer.ts`

### Prueba de disparadores (enviar cualquier archivo por FTP)
Para probar el disparo inmediato del servidor FTP integrado (remoto/imagen), podés subir un archivo arbitrario al servidor local desde esta misma PC.

- Objetivo: subir `mp.txt` (dispara Modo Remoto) o `direccion.txt` (dispara Modo Imagen) a la carpeta que expone el FTP Server.
- Requisito: en la sección “FTP Server” tener activo el servidor y anotar Host/PUERTO/Usuario/Contraseña y la carpeta raíz.

Opciones de envío:

1) PowerShell (curl)

```powershell
# Variables de ejemplo (ajusta usuario/contraseña/puerto/ruta)
$HOST = "127.0.0.1"   # si el servidor escucha en 0.0.0.0, para local usar 127.0.0.1
$PORT = 21             # o 2121 según tu config
$USER = "user"
$PASS = "pass"

# Subir mp.txt → dispara REMOTO (mp*.txt)
curl -T C:\tmp\mp.txt ftp://$USER:`$PASS@$HOST:$PORT/

# Subir direccion.txt → dispara IMAGEN
curl -T C:\tmp\direccion.txt ftp://$USER:`$PASS@$HOST:$PORT/
```

2) Node.js (basic-ftp)

```javascript
// npm i basic-ftp
const { Client } = require('basic-ftp');

(async () => {
  const c = new Client();
  try {
    await c.access({ host: '127.0.0.1', port: 21, user: 'user', password: 'pass', secure: false });
    // Sube mp.txt o direccion.txt según el disparador que quieras probar
    await c.uploadFrom('C:/tmp/mp.txt', 'mp.txt');
    // await c.uploadFrom('C:/tmp/direccion.txt', 'direccion.txt');
  } finally { c.close(); }
})();
```

Notas:
- Si el Host del servidor es `0.0.0.0`, para conectar desde la misma PC usá `127.0.0.1`.
- Asegurate de que las carpetas de control en Configuración apunten a la raíz del FTP Server o subcarpeta donde estás subiendo los archivos.
- Los disparos respetan días y horarios configurados.
