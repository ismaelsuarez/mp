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
- Disparadores (inmediatos): cuando está activo “Disparo inmediato por FTP (sin intervalo)”, al llegar `mp*.txt` (Remoto) o `direccion.txt` (Imagen) se procesan siempre (ignoran días/horas). En Remoto, el envío de `mp.dbf` se realiza en modo forzado (no se salta por “sin cambios”).

### Nuevas funcionalidades (integración con disparadores y pruebas)

- Disparo inmediato por FTP (sin intervalo):
  - En Configuración → Automatización:
    - Modo Remoto: activar “Disparo inmediato por FTP (sin intervalo)” y “Activar Modo Remoto”. Al subir un `mp*.txt` a `AUTO_REMOTE_DIR`, se procesa al instante (requiere `MP_ACCESS_TOKEN`).
    - Modo Imagen: activar “Disparo inmediato por FTP (sin intervalo)”. Al subir el archivo de control (por defecto `direccion.txt`) a `IMAGE_CONTROL_DIR`, se muestra de inmediato el contenido indicado en `URI`.
  - Requisitos: las carpetas `AUTO_REMOTE_DIR` (remoto) y `IMAGE_CONTROL_DIR` (imagen) deben coincidir con la carpeta raíz del FTP Server (`FTP_SRV_ROOT`) o ser subcarpetas de la misma.
  - Respeta días/horarios configurados en “Automatización”.
  - Tras procesar, el `.txt` se elimina automáticamente. Si el archivo está ocupado (EBUSY/EPERM/EACCES), se reintenta en el siguiente evento/intervalo.

- Envío manual de archivo por FTP (pruebas rápidas):
  - En Configuración → FTP ahora hay:
    - “Elegir archivo” para seleccionar un archivo local.
    - “Enviar archivo por FTP” para subirlo a la carpeta remota configurada.
  - Útil para probar disparadores: subir `mp.txt` o `direccion.txt` al servidor local e inmediatamente verificar que se ejecuten Remoto o Imagen.

- Limpieza y persistencia:
  - Control `.txt`: se borra tras procesarse. Además, si `IMAGE_CLEANUP_ENABLED` está activo, se limpian `.txt` antiguos de `IMAGE_CONTROL_DIR` con antigüedad mayor a `IMAGE_CLEANUP_HOURS` (por defecto 24 h).
  - Medios (imágenes/pdf/audio/video) no se copian ni borran: se visualizan desde su ubicación (local o UNC) y permanecen visibles hasta la próxima orden.

- Rutas UNC y visualización en logs:
  - Las rutas de red tipo `\\servidor\share\carpeta\archivo.ext` están soportadas.
  - En los logs JSON verás barras “dobles” por escape, pero la app usa la ruta exactamente como llegó en `URI` (no se normaliza ni modifica).
  - Si la ruta de red solicita credenciales, mapeá acceso persistente (ej.: `net use \\servidor\share /user:USUARIO CONTRASEÑA /persistent:yes`).

- Solución de problemas comunes:
  - “Invalid credentials” al subir por FTP: verifica usuario/contraseña de “FTP Server” y conecta a `127.0.0.1` o IP LAN y al puerto configurado (21/2121). Si usas 21, asegurá que no haya otro servicio ocupándolo.
  - Remoto no se ejecuta pese a `mp*.txt`: faltan credenciales de Mercado Pago (`MP_ACCESS_TOKEN`).
  - No se ve el medio: confirma que la ruta `URI` existe y es accesible con la misma sesión del usuario que corre la app.
