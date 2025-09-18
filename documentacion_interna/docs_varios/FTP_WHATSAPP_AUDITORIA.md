## Auditoría técnica — Módulo FTP WhatsApp (SFTP/FTP)

### Objetivo
Dejar documentado el flujo completo para el envío de archivos asociados a “WhatsApp” (PDF del recibo + archivo `wfa.txt`) hacia un servidor remoto. El módulo soporta SFTP (recomendado y actualmente forzado en UI) y mantiene compatibilidad con FTP cuando se necesite.

### Arquitectura y componentes
- UI: `public/config.html`
  - Sección “FTP WhatsApp”.
  - Campos: Host, Puerto, Usuario, Contraseña, Carpeta remota.
  - Botones: “Probar FTP WhatsApp”, “Guardar WhatsApp”, “Enviar archivo por FTP WhatsApp”.
  - Modo: SFTP fijo (checkbox FTPS oculto / SFTP deshabilitado y tildado).
- Preload (IPC expuesto a renderer): `src/preload.ts`
  - `testFtpWhatsappConnection()`, `ftpSendWhatsappFile(localPath, remoteName?)`.
- Proceso principal (IPC handlers): `src/main.ts`
  - `test-ftp-whatsapp` → prueba de conectividad.
  - `ftp:send-file-whatsapp` → envío manual de un archivo.
  - `save-config` con merge conservador (no sobrescribe claves no provistas).
- Servicio: `src/services/FtpService.ts` (núcleo)
  - FTP (basic-ftp) con fallback PASV/EPSV.
  - SFTP (ssh2-sftp-client) con verificación de host-key y auto‑persistencia del fingerprint.
  - Funciones: `testWhatsappFtp`, `sendFilesToWhatsappFtp`, `sendWhatsappFile`.
  - Helpers SFTP: `ensureSftpDir`, `testWhatsappSftpInternal`, `sendWhatsappFilesSftpInternal`, `sendWhatsappFileSftpInternal`.
- Flujo de negocio (cuando llega etiqueta WHATSAPP:): `src/modules/facturacion/facProcessor.ts`
  - Genera `wfa.txt` en la carpeta local del PDF.
  - Envía PDF + `wfa.txt` por WhatsApp (SFTP) usando `sendFilesToWhatsappFtp`.
  - Tras éxito, borra `wfa.txt` local.

### Configuración persistida
Se almacena en `electron-store` (archivo de settings cifrado con `config.key` en `app.getPath('userData')`). Claves relevantes:
```
FTP_WHATSAPP_IP      : string (host)
FTP_WHATSAPP_PORT    : number (p.ej. 5013)
FTP_WHATSAPP_USER    : string (usuario SSH)
FTP_WHATSAPP_PASS    : string (contraseña SSH)
FTP_WHATSAPP_DIR     : string (ruta remota, ej. /home/smsd/todocomputacion/sms)
FTP_WHATSAPP_SFTP    : boolean (true → SFTP)
FTP_WHATSAPP_SECURE  : boolean (solo aplica a FTP/FTPS; UI lo fuerza a false)
FTP_WHATSAPP_SSH_FP  : string (SHA-256 del host-key, guardado en primer login)
```
- En la UI “Guardar WhatsApp” fuerza `FTP_WHATSAPP_SFTP=true` y `FTP_WHATSAPP_SECURE=false`.
- `save-config` hace merge conservador con el JSON actual para no pisar campos.

### Dependencias
- `basic-ftp`: FTP plano/FTPS, PASV/EPSV configurable (usado como compatibilidad).
- `ssh2-sftp-client`: SFTP sobre SSH. Se usa para producción WhatsApp.
- `electron-store`: persistencia de configuración.
- `dayjs`: utilitario general (no crítico aquí).

### Flujo técnico — Prueba de conexión
1) UI → `testFtpWhatsappConnection()`.
2) main → `test-ftp-whatsapp`.
3) `FtpService.testWhatsappFtp()`:
   - Si `FTP_WHATSAPP_SFTP` es true o puerto ≠ 21 → `testWhatsappSftpInternal()`.
     - Conecta con `ssh2-sftp-client` usando host, puerto, usuario y contraseña.
     - `hostVerifier`: si no hay `FTP_WHATSAPP_SSH_FP`, guarda el hash recibido y acepta; si existe, compara y acepta sólo si coincide.
     - `ensureSftpDir(dir)` recursivo (mkdir -p) y devuelve OK.
   - Caso FTP (legacy): usa `basic-ftp`, `useEPSV=false` con fallback a EPSV.
4) Devuelve `{ ok: true }` o `{ ok: false, error }` a la UI.

### Flujo técnico — Envío manual desde UI
1) UI elige archivo → `ftpSendWhatsappFile(localPath)`.
2) main → `ftp:send-file-whatsapp`.
3) `FtpService.sendWhatsappFile()`:
   - Si SFTP activo → `sendWhatsappFileSftpInternal(cfg, localPath, remoteName?)`.
   - Construye ruta remota: `dir + '/' + basename(local)` y ejecuta `sftp.put`.
   - Logs de depuración: “WA SFTP: conectando…/subiendo archivo/archivo enviado”.

### Flujo técnico — Envío automático (WHATSAPP:) en Recibo
1) `facProcessor.ts` detecta `WHATSAPP:` en el `.fac` y extrae número.
2) Genera PDF local + `wfa.txt` con:
   - línea1: número WhatsApp
   - línea2: nombre de cliente
   - línea3: nombre de PDF
   - líneas siguientes: mensaje fijo
3) Llama `sendFilesToWhatsappFtp([pdfPath, wfaPath])` (SFTP):
   - Conecta, `ensureSftpDir`, `put` de ambos archivos.
   - Si éxito → borra `wfa.txt` local.
   - Si falla → log de advertencia, no bloquea resto del flujo (PDF ya generado; e-mail puede enviarse si hay EMAIL:).

### Logs y trazabilidad
`src/services/FtpService.ts` usa `logFtp/logSuccess/logWarning`:
- Prueba SFTP: “WA SFTP: conectando…/ensureDir OK/…error de prueba”.
- Envío SFTP múltiple: “conectando para envío múltiple…/subiendo archivo/archivo enviado/…error envío múltiple”.
- Envío SFTP individual: análogo con “individual”.
- Prueba FTP (legacy): “WA Test: usando FTP”.

### Seguridad y consideraciones
- Host-key almacenado en `FTP_WHATSAPP_SSH_FP` (SHA-256). Previene MITM en reconexiones.
- Se recomienda NO usar root en producción; crear usuario restringido con permisos a la carpeta destino.
- La UI oculta FTPS y fija SFTP=true para evitar errores de configuración.

### Checklist de diagnóstico
1) ¿`FTP_WHATSAPP_SFTP` es true y puerto es 5013?
2) ¿`Probar FTP WhatsApp` devuelve OK?
3) ¿Logs muestran “WA SFTP: conectando…/ensureDir OK”?
4) ¿Existe `FTP_WHATSAPP_SSH_FP` tras el primer login?
5) ¿Permisos de `/home/smsd/todocomputacion/sms` permiten escribir?
6) Envío manual desde UI funciona → entonces el flujo automático debería subir PDF + `wfa.txt`.

### Causas típicas de fallo y mitigación
- JSON sobrescrito por otra sección → Corregido con merge conservador en `save-config`.
- Puerto bloqueado/NAT (FTP PASV) → Se migra a SFTP (un solo puerto TCP, 5013).
- Host-key nueva (rotación en servidor) → verificar fingerprint; si cambió, limpiar `FTP_WHATSAPP_SSH_FP` o aceptar nuevo hash.

### Referencias de código
```
src/services/FtpService.ts
src/preload.ts
src/main.ts
public/config.html
src/modules/facturacion/facProcessor.ts
```


