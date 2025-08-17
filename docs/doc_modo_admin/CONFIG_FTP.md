## CONFIG – FTP

### Objetivo
Transferir automáticamente `mp.dbf` y evitar reenvíos innecesarios.

### Campos
- IP/Host y Puerto (21 por defecto)
- FTPS (explícito)
- Usuario / Contraseña
- Carpeta remota / Archivo remoto (DBF)

### Acciones
- Probar FTP
- Enviar DBF por FTP
- Limpiar Hash FTP

### Comportamiento
- Envío automático tras generación: enviado / sin cambios / error

### Referencias
- `src/services/FtpService.ts`, `src/main.ts`, `src/renderer.ts`
