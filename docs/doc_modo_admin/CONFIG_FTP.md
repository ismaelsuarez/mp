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
