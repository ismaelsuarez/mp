## Operación Recibo/Remito disparado por archivos .fac

### Propósito
- Documentar el estado actual y las reglas de funcionamiento de los flujos Recibo y Remito basados en archivos `.fac` para diagnóstico rápido, soporte y futuras entregas.

### Alcance
- Watcher `.fac` (detección y encolado)
- Persistencia de configuración (PV, contador, rutas, impresora)
- Resolución de fondos (FONDO: → templates)
- Generación de PDF y estructura de salida
- Envíos: impresión, email, WhatsApp, `.res` por FTP
- Notas de empaquetado y permisos (instalación)

---

## Watcher `.fac`
- Archivo: `src/main.ts` + `src/modules/facturacion/facWatcher.ts`.
- Estado: activado por defecto.
  - Claves de configuración:
    - `FACT_FAC_DIR`: carpeta observada (por defecto `C:\tmp`).
    - `FACT_FAC_WATCH`: solo se desactiva si se fuerza `false`. Por defecto `true`.
  - También puede “acoplarse” al FTP embebido: si `FTP_SRV_ENABLED=true`, observa `FTP_SRV_ROOT` además de `FACT_FAC_DIR`.
- Multi‑carpeta: el watcher inicia sobre todas las carpetas aplicables (dedicada y/o raíz FTP interno) y hace escaneo inicial de pendientes.
- Estabilidad de archivo: `facWatcher` espera que el tamaño quede estable y reintenta lectura para evitar EBUSY/EPERM durante la subida por FTP.
- Cola secuencial: cada `.fac` detectado se encola y se procesa en orden.
- Ruteo por tipo:
  - `TIPO: RECIBO` → `src/modules/facturacion/facProcessor.ts`
  - `TIPO: REMITO` → `src/modules/facturacion/remitoProcessor.ts`

### Diagnóstico rápido
- Carpeta efectiva: `FACT_FAC_DIR` o `FTP_SRV_ROOT`.
- Log esperado: “Fac watcher started { dir }” y luego “FAC detectado { filename }”.

---

## Persistencia de configuración
- Ubicación de escritura/lectura: `app.getPath('userData')/config` (instalación) para evitar permisos de `Program Files`.
- Migración automática: si existía `process.cwd()/config/*.json`, se copia a `userData/config` la primera vez.
- Archivos:
  - `recibo.config.json`: `{ pv, contador, outLocal, outRed1, outRed2 }`
  - `remito.config.json`: `{ pv, contador, outLocal, outRed1, outRed2, printerName? }`
- UI/IPC: `recibo:get-config/save-config`, `remito:get-config/save-config`.

---

## Resolución de Fondos (FONDO:)
- Etiqueta en `.fac`: `FONDO:<ruta o nombre>.jpg`.
- Algoritmo (ambos procesadores):
  1) Probar la ruta exacta provista (normalizando `\\`/`/`).
  2) Si no existe o no hay acceso, tomar el nombre de archivo (ej. `MiFondoRm.jpg`) y buscar en:
     - `templates/<nombre>.jpg` (desarrollo)
     - `resources/app/templates/<nombre>.jpg` (instalado, vía `app.getAppPath()`).
  3) Fallback final: `public/Noimage.jpg` empaquetado.
- Impacto: el cliente puede cambiar el archivo del fondo ya sea apuntando con `FONDO:` a una ruta propia o reemplazando un archivo en `templates` del programa con el mismo nombre informado en el `.fac`.

---

## Generación de PDF y estructura
- Directorio de salida local (obligatorio): `outLocal` del tipo correspondiente.
- Estructura: `Ventas_PV{pv}/F{YYYYMM}` dentro de `outLocal`.
- Nombres de archivo:
  - Recibo: `REC_{PV-4}-{NUM-8}.pdf`
  - Remito: `REM_{PV-4}-{NUM-8}.pdf`
- Copias a red: si se configuraron `outRed1` y/o `outRed2`, se copia el PDF final desde el local.

---

## Envíos y acciones posteriores
### Impresión
- Recibo: imprime según `COPIAS:` con impresora predeterminada.
- Remito: imprime según `COPIAS:`; si `printerName` configurado, usa esa impresora.

### Email
- Si el `.fac` trae `EMAIL:`, se envía el PDF adjunto con título acorde (“Recibo de pago” / “Remito”).

### WhatsApp
- Si el `.fac` trae `WHATSAPP:`, se genera `wfa*.txt` con:
  1) Teléfono normalizado (+54…)
  2) Nombre del cliente
  3) Nombre del PDF
  4) Mensaje fijo
- Se suben PDF + `wfa*.txt` por el canal de WhatsApp (SFTP/FTP). Tras éxito, se borra local el `wfa*.txt`.

### Archivo `.res` + FTP
- Recibo: `.res` con sufijo minúscula (últimos 8 del base del `.fac`).
- Remito: `.res` con sufijo forzado `r` minúscula.
- Tras subir por FTP (`sendArbitraryFile`), se borra `.res` y el `.fac` original.

---

## Notas de empaquetado y permisos
- Escritura: configs y artefactos de ejecución en `userData` (no `Program Files`).
- Recursos de solo lectura: `public/**` y `templates/**` deben ir empaquetados en `resources/app`.
- Fallbacks de rutas en producción usan `app.getAppPath()`.

---

## Checklist de Smoke Test (pre‑release)
1) Watcher activo (por defecto) y carpeta `C:\tmp` existente.
2) Dejar 1 `.fac` de Recibo y 1 de Remito:
   - Ver PDFs en `outLocal/Ventas_PVxx/FYYYYMM`.
   - Ver copias en red si corresponde.
   - Impresión según `COPIAS:`.
   - Si `EMAIL:`/`WHATSAPP:`: envío OK.
   - `.res` subido por FTP y limpieza de `.res` + `.fac`.
3) Cambiar `FONDO:` a un path inválido; confirmar que toma el mismo nombre desde `templates` del programa.

---

## Troubleshooting rápido
- No detecta `.fac`:
  - Ver `FACT_FAC_DIR` y/o `FTP_SRV_ROOT`. Confirmar en log “Fac watcher started”.
  - Confirmar que el archivo termina en `.fac` y que la carpeta existe.
- EPERM/ENOENT al guardar configs:
  - Verificar que `userData/config` sea accesible. La app migra configs desde `process.cwd()` si existieran.
- Fondo no se ve:
  - Confirmar que el nombre de `FONDO:` esté presente en `templates` del programa o que la ruta absoluta sea válida.

---

## Referencias de código
- Watcher: `src/modules/facturacion/facWatcher.ts`
- Arranque y ruteo: `src/main.ts` (cola `.fac`, IPC, watchers)
- Recibo: `src/modules/facturacion/facProcessor.ts`
- Remito: `src/modules/facturacion/remitoProcessor.ts`
- Email: `src/services/EmailService.ts`
- Whatsapp/FTP: `src/services/FtpService.ts`


