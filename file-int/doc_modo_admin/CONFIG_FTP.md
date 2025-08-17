## CONFIG – FTP

### Objetivo
Transferir automáticamente el archivo `mp.dbf` al servidor FTP y evitar reenvíos innecesarios mediante hash.

### Campos
- **IP/Host** (`FTP_IP`) y **Puerto** (`FTP_PORT`): por defecto 21.
- **FTPS** (`FTP_SECURE`): activar si el servidor requiere TLS explícito.
- **Usuario/Contraseña** (`FTP_USER` / `FTP_PASS`).
- **Carpeta remota** (`FTP_DIR`): ruta destino en el servidor.
- **Archivo remoto (DBF)** (`FTP_FILE`): nombre esperado en el servidor (opcional; por defecto `mp.dbf`).

### Acciones
- **Probar FTP**: valida conexión y credenciales.
- **Enviar DBF por FTP**: envía `mp.dbf` del día (manual).
- **Limpiar Hash FTP**: fuerza el próximo envío (ignora “sin cambios”).

### Comportamiento (auto/manual/remoto)
- Tras generar archivos, el sistema intenta enviar `mp.dbf`:
  - Sin cambios: mensaje “FTP: sin cambios - no se envía”.
  - Enviado: mensaje “FTP: enviado OK”.
  - Error: muestra mensaje y registra en logs.

### Referencias
- Implementación: `src/services/FtpService.ts`, `src/main.ts` (flujos de envío), `src/renderer.ts` (UI).
