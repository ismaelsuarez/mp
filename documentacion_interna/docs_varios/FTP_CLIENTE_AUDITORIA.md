## Auditoría técnica — Cliente FTP (envío de archivos)

### Alcance
- Este documento describe el funcionamiento actual del cliente FTP de la aplicación (UI + IPC + servicios) y define puntos de extensión para modificaciones solicitadas por auditoría.
- Cubre el envío de `mp.dbf`/`transactions-detailed-YYYY-MM-DD.dbf` y el envío de archivos arbitrarios.

### Componentes y ubicaciones
- UI (Administración): `public/config.html` — Sección “FTP”.
- IPC (proceso principal): `src/main.ts` — handlers `send-dbf-ftp`, `ftp:send-file`, `clear-ftp-hash`.
- Servicio FTP: `src/services/FtpService.ts` — funciones `testFtp`, `sendTodayDbf`, `sendDbf`, `sendArbitraryFile` y utilidades (hash, normalización de directorios, logging).
- Preload (exposición a renderer): `src/preload.ts` — wrappers `sendDbfViaFtp`, `ftpSendFile`, `clearFtpHash`.

### Configuración utilizada
- Claves leídas por el servicio (obtenidas vía `getConfig()`):
  - `FTP_IP` (string): host o IP del servidor.
  - `FTP_PORT` (number, opcional): puerto. Por defecto 21.
  - `FTP_USER` (string): usuario.
  - `FTP_PASS` (string): contraseña.
  - `FTP_SECURE` (boolean): FTPS explícito si `true`.
  - `FTP_DIR` (string): carpeta remota (se crea si no existe).
  - `FTP_FILE` (string, opcional): nombre preferido de archivo DBF (si no hay `mp.dbf`).

Notas de seguridad:
- El proyecto utiliza puerto 21 por requerimiento. Si el servidor exige TLS explícito, activar `FTP_SECURE=true` y mantener puerto 21.
- No almacenar credenciales en `.env` para entornos productivos; deben residir en el almacén de secretos administrado.

### Flujo UI → IPC → Servicio
1) La UI muestra los campos de conexión, carpeta remota y nombre de archivo.
2) Acciones disponibles:
   - Probar FTP (conexión y acceso a carpeta remota).
   - Enviar archivo por FTP (selección de archivo y, opcionalmente, nombre remoto).
   - Enviar DBF del día (elige automáticamente el archivo DBF local según prioridad).
   - Limpiar hash de último DBF enviado (para forzar reenvío).

Handlers IPC relevantes en `src/main.ts` (extractos):
```2791:2810:src/main.ts
ipcMain.handle('recibo:save-config', async (_e, cfg: { pv?: number; contador?: number; outLocal?: string; outRed1?: string; outRed2?: string; printerName?: string }) => {
  try {
    const current = readReciboCfg();
    const next = {
      pv: typeof cfg?.pv === 'number' ? cfg.pv : current.pv,
      contador: typeof cfg?.contador === 'number' ? cfg.contador : current.contador,
      outLocal: typeof cfg?.outLocal === 'string' ? cfg.outLocal : current.outLocal,
      outRed1: typeof cfg?.outRed1 === 'string' ? cfg.outRed1 : current.outRed1,
      outRed2: typeof cfg?.outRed2 === 'string' ? cfg.outRed2 : current.outRed2,
      printerName: typeof cfg?.printerName === 'string' ? cfg.printerName : current.printerName,
    };
    const res = writeReciboCfg(next);
    return res.ok ? { ok: true } : { ok: false, error: res.error };
  } catch (e: any) {
    return { ok: false, error: e?.message || String(e) };
  }
});
ipcMain.handle('send-dbf-ftp', async () => {
  try { const res = await sendTodayDbf(); return { ok: true, ...res }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
});
ipcMain.handle('ftp:send-file', async (_e, { localPath, remoteName }: { localPath: string; remoteName?: string }) => {
  try { if (!localPath) return { ok: false, error: 'Ruta local vacía' }; const res = await sendArbitraryFile(localPath, remoteName); return { ok: true, ...res }; } catch (e: any) { return { ok: false, error: String(e?.message || e) }; }
});
```

API expuesta en `src/preload.ts` (extracto):
```22:31:src/preload.ts
async sendDbfViaFtp() { return await ipcRenderer.invoke('send-dbf-ftp'); },
async ftpSendFile(localPath: string, remoteName?: string) { return await ipcRenderer.invoke('ftp:send-file', { localPath, remoteName }); },
async clearFtpHash() { return await ipcRenderer.invoke('clear-ftp-hash'); }
```

### Servicio `src/services/FtpService.ts`

Funciones principales (extractos):
```105:138:src/services/FtpService.ts
export async function sendTodayDbf() {
  const cfg = getConfig();
  if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS) throw new Error('Config FTP incompleta');
  const tag = dayjs().format('YYYY-MM-DD');
  const documentsDir = app.getPath('documents');
  const outDir = path.join(documentsDir, 'MP-Reportes');
  const preferred = 'mp.dbf';
  let fileName = preferred;
  let localPath = path.join(outDir, fileName);
  if (!fs.existsSync(localPath)) {
    fileName = cfg.FTP_FILE || `transactions-detailed-${tag}.dbf`;
    localPath = path.join(outDir, fileName);
  }
  if (!fs.existsSync(localPath)) throw new Error(`No existe archivo DBF local: ${localPath}`);
  const client = new Client();
  try {
    await client.access({ host: String(cfg.FTP_IP), port: 21, user: String(cfg.FTP_USER), password: String(cfg.FTP_PASS), secure: false });
    const dir = normalizeDir(cfg.FTP_DIR);
    if (dir) await client.ensureDir(dir);
    const remoteName = path.basename(fileName);
    await client.uploadFrom(localPath, remoteName);
    return { remoteDir: dir || '/', remoteFile: remoteName };
  } finally { client.close(); }
}
```

```140:195:src/services/FtpService.ts
export async function sendDbf(localPath: string, remoteFileName: string = 'mp.dbf', options?: { force?: boolean }) {
  const cfg = getConfig();
  if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS) { recordError('FTP_CONFIG', 'Configuración FTP incompleta para envío', { config: { hasIp: !!cfg.FTP_IP, hasUser: !!cfg.FTP_USER, hasPass: !!cfg.FTP_PASS } }); throw new Error('Config FTP incompleta'); }
  if (!fs.existsSync(localPath)) { recordError('FTP_FILE', 'Archivo DBF no encontrado', { localPath, remoteFileName }); throw new Error(`No existe archivo DBF local: ${localPath}`); }
  const forceSend = !!(options && options.force);
  if (!forceSend) {
    const fileChanged = hasFileChanged(localPath);
    if (!fileChanged) { logFtp('Archivo mp.dbf sin cambios - omitiendo envío FTP'); return { remoteDir: normalizeDir(cfg.FTP_DIR) || '/', remoteFile: remoteFileName.toLowerCase(), skipped: true, reason: 'sin cambios - no se envía' }; }
  }
  logFtp('Archivo mp.dbf con cambios - enviando por FTP...');
  const client = new Client();
  try {
    await client.access({ host: String(cfg.FTP_IP), port: 21, user: String(cfg.FTP_USER), password: String(cfg.FTP_PASS), secure: false });
    const dir = normalizeDir(cfg.FTP_DIR);
    if (dir) await client.ensureDir(dir);
    const remoteName = remoteFileName.toLowerCase();
    await client.uploadFrom(localPath, remoteName);
    const currentHash = calculateFileHash(localPath);
    saveLastSentHash(currentHash);
    return { remoteDir: dir || '/', remoteFile: remoteName, hash: currentHash };
  } finally { client.close(); }
}
```

```198:225:src/services/FtpService.ts
export async function sendArbitraryFile(localPath: string, remoteFileName?: string) {
  const cfg = getConfig();
  if (!cfg.FTP_IP || !cfg.FTP_USER || !cfg.FTP_PASS) { recordError('FTP_CONFIG', 'Configuración FTP incompleta para envío', { config: { hasIp: !!cfg.FTP_IP, hasUser: !!cfg.FTP_USER, hasPass: !!cfg.FTP_PASS } }); throw new Error('Config FTP incompleta'); }
  if (!fs.existsSync(localPath)) { recordError('FTP_FILE', 'Archivo local no encontrado', { localPath }); throw new Error(`No existe archivo local: ${localPath}`); }
  const client = new Client();
  try {
    await client.access({ host: String(cfg.FTP_IP), port: Number(cfg.FTP_PORT || 21), user: String(cfg.FTP_USER), password: String(cfg.FTP_PASS), secure: !!cfg.FTP_SECURE });
    const dir = normalizeDir(cfg.FTP_DIR);
    if (dir) await client.ensureDir(dir);
    const remoteName = String(remoteFileName || path.basename(localPath));
    await client.uploadFrom(localPath, remoteName);
    logSuccess('Archivo enviado por FTP', { localPath, remote: `${dir || '/'}${remoteName}` });
    return { remoteDir: dir || '/', remoteFile: remoteName };
  } finally { client.close(); }
}
```

### Reglas operativas
- Puerto: 21 (requerido). Si `FTP_SECURE=true`, se usa FTPS explícito sobre 21.
- Directorio remoto: si `FTP_DIR` está definido, se garantiza con `ensureDir`.
- Nombres de archivo:
  - DBF preferido: `mp.dbf`. Alternativa: `FTP_FILE`. Fallback: `transactions-detailed-YYYY-MM-DD.dbf`.
  - En `sendDbf`, el nombre remoto se fuerza a minúsculas.
- Política de omisión (DBF): se evita el reenvío si no cambió el hash, salvo `force=true`.

### Manejo de errores y logging
- Errores de configuración/archivo no encontrado se registran con `recordError(código, mensaje, detalle)`.
- Mensajes informativos con `logFtp`, éxitos con `logSuccess`.
- En los IPC, la respuesta siempre es `{ ok: boolean, ...datos | error }`.

### Seguridad
- Credenciales se leen del almacén de configuración. No deben persistirse en texto plano fuera de los mecanismos establecidos.
- FTPS explícito opcional (STARTTLS). No se soporta FTPS implícito en un puerto distinto en la implementación actual.

### Casos de uso
1) Probar conexión: UI → `testFtp()` (valida acceso y carpeta).
2) Enviar DBF del día: UI → `send-dbf-ftp` → `sendTodayDbf()`.
3) Enviar archivo arbitrario: UI → `ftp:send-file` → `sendArbitraryFile(local, nombreRemoto?)`.
4) Forzar reenvío DBF: UI → `clear-ftp-hash` → borra hash → `sendDbf(..., { force:true })`.

### Secuencia (texto)
1) Usuario configura IP/puerto/usuario/contraseña/FTPS/carpeta.
2) Al enviar, el main invoca el servicio que:
   - Abre sesión, asegura el directorio y llama `uploadFrom`.
   - Cierra la conexión en `finally`.
3) Devuelve `{ ok:true, remoteDir, remoteFile }` a la UI.

### Validaciones y límites conocidos
- Requiere conectividad TCP al puerto 21 del servidor.
- Con FTPS, el servidor debe soportar TLS explícito.
- Si el servidor no permite `ensureDir`, la creación de carpeta puede fallar (se devolverá `error`).

### Pruebas manuales (checklist)
1) Probar FTP con credenciales válidas → debería responder `ok`.
2) Probar FTP con carpeta inexistente → debe crearse (si permisos lo permiten) o devolver error.
3) Enviar DBF con `mp.dbf` presente → debe subir `mp.dbf`.
4) Enviar DBF sin `mp.dbf` pero con `FTP_FILE` → debe subir ese nombre.
5) Enviar DBF sin cambios (sin `force`) → debe omitir envío con `skipped: true`.
6) Enviar archivo arbitrario con `remoteName` → debe subir con ese nombre.
7) Activar `FTP_SECURE=true` y verificar handshake TLS.

### Propuestas de mejora (opcional)
- Reintentos con backoff (e.g., 3 intentos, 1s/2s/5s) ante `ECONNRESET`/`ETIMEDOUT`.
- Timeouts configurables por operación (conexión, `ensureDir`, `uploadFrom`).
- Logs estructurados por correlación (requestId) para auditoría de lotes.
- Métrica de bytes enviados y duración para cada `uploadFrom`.
- Validación previa de tamaño/fecha archivo y logging de MD5/SHA256 en éxito.
- Soporte de máscara de nombre remoto desde UI (placeholders: `{YYYY}`, `{MM}`, `{DD}`).

### Resumen de impactos
- El cliente opera sobre puerto 21 (cumple política).
- FTPS opcional, sin romper escenarios FTP plano.
- Política de no duplicar envío DBF por hash, reducible con `force`.
- Directorios remotos garantizados cuando es posible.


