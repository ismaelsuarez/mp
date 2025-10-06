## 📘 INFORME TÉCNICO — Módulo Mercado Pago (Pagos → Reportes → FTP mp.dbf)

### 🎯 Alcance
Este documento describe en detalle el flujo end‑to‑end del módulo de Mercado Pago en la app (Electron + TypeScript):
- Consulta de pagos vía SDK oficial.
- Normalización y generación de salidas: JSON, CSV, CSV full, XLSX y DBF.
- Creación de alias fijo `mp.dbf`.
- Envío por FTP dedicado (Mercado Pago) con deduplicación por hash.
- Disparadores: manual (UI), remoto (`mp*.txt`) y utilidades relacionadas (A13).

La carpeta de salida por defecto es `C:\2_mp\reportes` (si no hay permisos, se usa `Documentos/MP-Reportes`).

---

### 🧩 Componentes y archivos relevantes
- UI de configuración: `public/config.html` (sección Mercado Pago) — carga/guardado de credenciales y parámetros, prueba de conexión.
- Orquestación (proceso principal): `src/main.ts` — IPC, ejecución del flujo de reportes, triggers remotos y envío FTP automático.
- Cliente MP + búsqueda: `src/services/MercadoPagoService.ts` — `searchPaymentsWithConfig()` y `testConnection()`.
- Generación de archivos: `src/services/ReportService.ts` — `getOutDir()` y `generateFiles()` (CSV/CSV full/XLSX/DBF + `mp.dbf`).
- FTP dedicado MP: `src/services/FtpService.ts` — `getMpFtpConfig()`, `testMpFtp()`, `sendMpDbf()` (deduplicación), `sendMpFtpFile(s)`.
- Trigger alterno A13 (padrón AFIP): `src/services/A13FilesService.ts` — genera `*.dbf` y reutiliza el FTP MP.

Dependencias principales: `mercadopago`, `dbffile`, `exceljs`, `papaparse`, `basic-ftp`, `electron-store`, `dayjs`.

---

## 1) Configuración y persistencia

### 1.1 Dónde se almacenan los valores
La configuración vive en `electron-store` (`settings.json`) dentro de `app.getPath('userData')`. Se cifra con una `encryptionKey` local (`config.key`).

### 1.2 Campos de Mercado Pago (consulta)
- `MP_ACCESS_TOKEN` (obligatorio, `APP_USR-...`).
- `MP_USER_ID` (opcional).
- Fechas y ventana:
  - `MP_TZ` (por defecto `America/Argentina/Buenos_Aires`).
  - `MP_DATE_FROM`, `MP_DATE_TO` (rango manual, opcional).
  - `MP_DAYS_BACK` (por defecto 7) — rango relativo si no hay fechas manuales.
  - `MP_NO_DATE_FILTER` (true = consulta sin rango de fechas).
  - `MP_RANGE` (campo de fecha a filtrar; recomendado `date_last_updated`).
- Página/orden/estado:
  - `MP_LIMIT` (por página; por defecto 50), `MP_MAX_PAGES` (por defecto 100).
  - `MP_SORT` (por defecto `date_created`), `MP_CRITERIA` (`desc`).
  - `MP_STATUS` (opcional: `approved`, etc.).

Estos valores se cargan/guardan desde la UI en `public/config.html` y se consultan en backend al ejecutar el flujo.

### 1.3 Configuración FTP (Mercado Pago — dedicada)
- `MP_FTP_IP`, `MP_FTP_PORT` (por defecto 21), `MP_FTP_SECURE` (FTPS opcional).
- `MP_FTP_USER`, `MP_FTP_PASS`.
- `MP_FTP_DIR` (directorio remoto).

Esta configuración es usada exclusivamente por `sendMpDbf()` y helpers asociados, separada del FTP genérico de la app.

---

## 2) Consulta a Mercado Pago (SDK oficial)

### 2.1 Flujo
1. Construcción del cliente: se usa `mercadopago` con `accessToken` y timeout 30s.
2. Rango de fechas:
   - Si `MP_NO_DATE_FILTER=true` → sin `begin_date/end_date`.
   - Si hay `MP_DATE_FROM/TO` → se arma rango exacto en TZ configurada y se convierte a UTC ISO.
   - Si no, se usa rango relativo de `MP_DAYS_BACK` días (incluye hoy) en la TZ configurada.
3. Paginación: `limit`/`offset` hasta `MP_MAX_PAGES` o fin de datos.
4. Filtro adicional por `status` (si está definido).

### 2.2 Salida de la consulta
La función `searchPaymentsWithConfig()` retorna:
```json
{
  "payments": [...],
  "range": { "begin_date": "...", "end_date": "...", "range": "date_last_updated", "noDate": false },
  "configUsed": { "limit": 50, "maxPages": 100, "status": null }
}
```
Errores de comunicación se reportan con `recordError('MP_COMM', ...)` y se propagan al llamador.

---

## 3) Generación de archivos (out dir y formatos)

### 3.1 Carpeta de salida
`getOutDir()` prioriza `C:\\2_mp\\reportes`. Si falla (permisos), usa `Documentos/MP-Reportes`.

### 3.2 Archivos generados por `generateFiles(payments, tag, rangeInfo)`
- `balance-YYYY-MM-DD.json`: resumen con rango usado y totales aproximados (ingresos/devoluciones) a partir de pagos.
- `transactions-YYYY-MM-DD.csv`: columnas operativas curadas.
- `transactions-full-YYYY-MM-DD.csv`: JSON aplanado (todas las claves disponibles).
- `transactions-full-YYYY-MM-DD.xlsx`: tabla Excel (con headers y filas normalizadas).
- `transactions-detailed-YYYY-MM-DD.dbf`: DBF curado (esquema dBase, nombres ≤ 10 caracteres).
- Copia fija: `mp.dbf` (copia de `transactions-detailed-YYYY-MM-DD.dbf`).

Totales calculados (JSON):
```json
{ "incomes": 12345.67, "refunds": 890.12 }
```

### 3.3 Esquema DBF (detailed)
Campos (tipo/tamaño):
- `OP_ID` (C,20), `DT_CRT` (C,32), `DT_APR` (C,32), `STATUS` (C,20), `ST_DET` (C,40), `CURR` (C,5)
- `AMOUNT` (N,15,2), `NET` (N,15,2), `FEES` (N,15,2)
- `PM_ID` (C,20), `PT_ID` (C,20), `INST` (N,5)
- `EMAIL` (C,80), `FNAME` (C,40), `LNAME` (C,40)
- `DOC_T` (C,6), `DOC_N` (C,20)
- `EXTREF` (C,60), `STORE` (C,20), `POS` (C,20), `ORDER` (C,20)
- `LAST4` (C,4), `HOLDER` (C,80)

Inserción en lotes de 1000 registros. Luego se crea/actualiza `mp.dbf` por copia directa.

---

## 4) Orquestación del flujo (Main process)

### 4.1 Ejecución canónica
`runReportFlowAndNotify(origin)`:
1. Llama a `searchPaymentsWithConfig()` → `payments` y `range`.
2. Invoca `generateFiles()` (maneja reintentos ante errores de archivo comunes: `EPERM/EACCES/EBUSY/EEXIST`).
3. Si existe `mp.dbf`, intenta envío automático por FTP Mercado Pago (`sendMpDbf(..., { force: true })`).
4. Notifica a la UI por IPC (`auto-report-notice`) con resultado/resumen.

### 4.2 Disparadores
- Manual (UI): botón/acción de descarga llama a este flujo.
- Remoto: si en la carpeta configurada aparece un `mp*.txt`, se dispara el mismo flujo y se elimina el archivo de control al finalizar.
- A13: si aparece `a13*.txt`, se ejecuta `processA13TriggerFile()` (genera su propio DBF) y lo envía usando el FTP MP; es independiente de `mp.dbf`.

---

## 5) Envío por FTP (Mercado Pago)

### 5.1 Configuración dedicada
`getMpFtpConfig()` lee `MP_FTP_*` del store y valida credenciales en `testMpFtp()`.

### 5.2 Envío de `mp.dbf`
- `sendMpDbf(localPath?, remoteFileName?, { force? })`:
  - Si no se pasa `localPath`, usa `getOutDir()/mp.dbf`.
  - Deduplicación por MD5: si `remoteFileName === 'mp.dbf'` y no es `force`, compara hash con el último enviado (clave separada `lastMpDbfHashDedicated`). Si no cambió, omite envío.
  - En éxito, actualiza el hash y registra `MP FTP: archivo enviado`.
  - Errores de config/léctura se reportan y se lanzan.

La orquestación en `main.ts` usa `{ force: true }` tras generar archivos, para asegurar envío inmediato.

### 5.3 Helpers
- `sendMpFtpFile(localPath, remoteFileName?, options?)` y `sendMpFtpFiles(paths[], names[])` reutilizan la misma configuración dedicada.

---

## 6) UI, IPC y experiencia operativa

### 6.1 Configuración en UI (`public/config.html`)
- Campos: token MP, user id, TZ, fechas/rangos, límites/paginación y botones “Guardar Mercado Pago” y “Probar conexión”.
- Al cargar, la UI invoca `window.api.getConfig()` y rellena inputs; al guardar, fusiona la configuración y persiste en `settings`.

### 6.2 IPC relevante (`src/main.ts`)
- `open-out-dir`: abre la carpeta de salida.
- `list-history`: lista por fecha las salidas generadas.
- `mp-ftp:test`: prueba conexión FTP dedicada MP.
- `mp-ftp:get-config` / `mp-ftp:save-config`: leer/escribir configuración FTP MP.
- `mp-ftp:send-dbf`: envía `mp.dbf` forzado.
- `auto-report-notice`: notifica a la UI (informativo/errores) al cerrar el flujo.

---

## 7) Manejo de errores y reintentos
- Consulta MP: los fallos en `payment.search` registran `MP_COMM` y abortan.
- Generación de archivos: ante errores típicos de archivo se hace un reintento con breve espera.
- FTP MP: valida configuración; si `mp.dbf` no existe, falla con error claro. Deduplicación segura evita envíos innecesarios.
- Disparador remoto: cada archivo `mp*.txt` procesado se elimina; si falla, se registran mensajes de error por IPC.

---

## 8) Validaciones funcionales sugeridas (QA)
- “Probar conexión” MP (UI) debe devolver OK con token válido.
- Ejecutar flujo y verificar generación de: JSON, CSV, CSV full, XLSX y DBF; y la copia `mp.dbf`.
- Enviar manual `mp.dbf` por `mp-ftp:send-dbf` y verificar en el servidor remoto.
- Re-ejecutar sin cambios y validar que, sin `force`, `sendMpDbf` omite envío por hash.
- Probar disparador remoto con un `mp.txt` en la carpeta configurada.
- A13: colocar `a13_*.txt` con CUIT en la primera línea, verificar `*.dbf` y envío por FTP MP.

---

## 9) Consideraciones de seguridad y operación
- El `Access Token` se cifra en repositorio local de `electron-store` con una clave por máquina (`config.key`).
- La carpeta `C:\\2_mp\\reportes` puede requerir permisos elevados; si falla, el sistema cae en `Documentos/MP-Reportes`.
- El FTP dedicado para MP está aislado del FTP general y del FTP de WhatsApp.

---

## 10) Resumen del flujo end‑to‑end
1. UI (o trigger remoto) inicia “Descargar MP”.
2. Backend consulta pagos (`searchPaymentsWithConfig`).
3. Backend genera archivos (`generateFiles`) en `getOutDir()` y crea `mp.dbf`.
4. Backend intenta envío automático por FTP MP (`sendMpDbf`, forzado tras generación).
5. UI recibe `auto-report-notice` con resultado y detalles; se puede abrir la carpeta de salida.

---

### Referencia rápida de nombres de archivo
- `balance-YYYY-MM-DD.json`
- `transactions-YYYY-MM-DD.csv`
- `transactions-full-YYYY-MM-DD.csv`
- `transactions-full-YYYY-MM-DD.xlsx`
- `transactions-detailed-YYYY-MM-DD.dbf`
- `mp.dbf` (alias fijo requerido por integración)

