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

### FTP Server integrado (opcional)
- Permite exponer una carpeta local como servidor FTP dentro de la misma app.
- Configurable en Admin → “FTP Server”.
- Campos: Host (0.0.0.0= todas las IPs), Puerto (por defecto 2121), Usuario/Contraseña, Carpeta raíz, Habilitado (autoarranque).
- Botón “Iniciar/Detener servidor FTP”. Muestra URL y raíz.
- Requiere que el puerto elegido esté libre (p.ej. si usas 21, desactiva IIS/FileZilla) y que el firewall permita 21 y PASV 49152–65534.

### Referencias
- Cliente: `src/services/FtpService.ts`
- Server: `src/services/FtpServerService.ts`, IPC en `src/main.ts`, UI en `public/config.html` y `src/renderer.ts`
