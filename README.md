### Proyecto MP – Reportes de Pagos Mercado Pago (TypeScript + Electron)

Este proyecto genera reportes operativos de ventas (Pagos) usando el SDK oficial de Mercado Pago, y envía por email los archivos resultantes (CSV, CSV full, XLSX y DBF) junto con un resumen JSON. Sirve como base estable para futuras ampliaciones (reportes de liquidaciones/finanzas y snapshots de saldo).

---

### Alcance y funcionalidades

- Integración SDK oficial (`mercadopago`) para listar pagos vía `payments/search`.
- Generación de salidas en `out/`:
  - `transactions-YYYY-MM-DD.csv` (curado)
  - `transactions-full-YYYY-MM-DD.csv` (todas las columnas aplanadas)
  - `transactions-full-YYYY-MM-DD.xlsx` (tabla Excel)
  - `transactions-detailed-YYYY-MM-DD.dbf` (curado, compatible dBase)
  - `balance-YYYY-MM-DD.json` (resumen con ingresos/devoluciones aproximados desde pagos)
- Envío por email de los archivos adjuntos si hay SMTP y destinatario configurados.
- Filtros de fecha configurables: día completo, rango por fechas o sin filtro.
- Paginación configurable para cubrir conjuntos de datos grandes.

---

### Estructura del proyecto

- App de escritorio (Electron, TS): `src/main.ts`, `src/preload.ts`, `src/renderer.ts`, `src/services/*`
- CLI (TS): `mp-sdk/report.ts` (reportes) y `mp-sdk/account-money-process.ts` (normalizador)
- Servicio SDK CLI: `mp-sdk/services/MercadoPagoService.ts`
- `dist/`: salida compilada de TypeScript
- `out/`: carpeta de salida de la CLI creada en tiempo de ejecución
- `.env`: variables de entorno (para CLI)
- `package.json`: scripts y dependencias del proyecto

---

### Requisitos

- Node.js 18+
- Access Token de producción de Mercado Pago (`APP_USR-…`)
- Credenciales SMTP si se desea enviar emails

---

### Instalación y uso rápido

1) Instalar dependencias
```bash
npm install
```

2) Configurar `.env` (ver ejemplo y descripción más abajo)

3) App de escritorio (Electron, compila TS y abre la GUI)
```bash
npm start
```

4) CLI – Ejecutar reporte del día (00:00–23:59 en la TZ configurada)
```bash
npm run mp:payments:report:dist
```

5) CLI – Ejecutar con rango de fechas (días completos)
```bash
MP_DATE_FROM=YYYY-MM-DD MP_DATE_TO=YYYY-MM-DD npm run mp:payments:report:dist
```

6) CLI – Traer todo sin fechas (diagnóstico)
```bash
MP_NO_DATE_FILTER=true npm run mp:payments:report:dist
```

7) CLI – Procesar CSV “Dinero en cuenta” (opcional)
```bash
MP_ACCOUNT_CSV_PATH=/ruta/reporte_panel.csv npm run mp:account:process:dist
```

---

### Construir instalador para Windows (.exe)

Requisitos recomendados:
- Ejecutar el build en Windows (PowerShell/Terminal) con Node.js 18+ instalado.
- Opcional: firma de código (si usas certificados, ver variables `CSC_*`).

Pasos (Windows):
```powershell
# 1) Ir a la carpeta del proyecto (puedes usar la ruta WSL compartida: \\wsl$\Ubuntu\home\ismael\mp)
cd C:\ruta\a\mp

# 2) Instalar dependencias y compilar TypeScript
npm ci
npm run build:ts

# 3) Generar instalador .exe con electron-builder
npx electron-builder -w
# Alternativa: npm run build (en Windows generará el instalador para Windows)
```

Salida:
- El instalador quedará en `dist/` con un nombre similar a `MP Reports Setup x.y.z.exe`.

Notas de firma (opcional):
- Si tienes certificado, configura variables de entorno antes de construir:
  - `CSC_LINK` (ruta/URL al .pfx/.pem) y `CSC_KEY_PASSWORD`.
- Si no firmas, el .exe será no firmado (Windows puede mostrar advertencia de editor desconocido).

WSL2:
- Se recomienda correr el build en el host Windows. Desde WSL puedes abrir la carpeta en Windows vía `\\wsl$` o copiar el proyecto a NTFS.

---

### Variables de entorno (.env)

```env
# ── Credenciales Mercado Pago (obligatorias)
MP_ACCESS_TOKEN=APP_USR_xxx_tu_token
MP_USER_ID=me

# ── Zona horaria y ventanas (por defecto día completo)
MP_TZ=America/Argentina/Buenos_Aires
MP_WINDOW_START=00:00
MP_WINDOW_END=23:59

# ── Rango manual (día completo en la TZ)
MP_DATE_FROM=           # YYYY-MM-DD
MP_DATE_TO=             # YYYY-MM-DD

# ── Sin filtro de fechas (trae todo)
MP_NO_DATE_FILTER=false # true para desactivar begin/end

# ── Búsqueda y filtros
MP_RANGE=date_last_updated   # date_created | date_approved | date_last_updated
MP_STATUS=                   # ej: approved o approved,refunded
MP_LIMIT=50                  # ítems por página (paginación)
MP_MAX_PAGES=100             # páginas máximas

# ── Email de reporte (opcional pero recomendado)
EMAIL_REPORT=contabilidad@tuempresa.com
ADMIN_ERROR_EMAIL=admin@tuempresa.com
SMTP_HOST=smtp.gmail.com
SMTP_PORT=587
SMTP_USER=tu_email@gmail.com
SMTP_PASS=tu_password
```

Notas:
- Si `EMAIL_REPORT` y `SMTP_*` están definidos, el script envía un email con los archivos adjuntos.
- `MP_RANGE` controla el campo de fecha usado para el filtro. Para capturar aprobaciones/tickets actualizados en el día, `date_last_updated` es una opción robusta.
- `MP_NO_DATE_FILTER=true` desactiva todo filtro de fechas (útil para diagnóstico). Úsalo con cautela en cuentas con muchas operaciones.

---

### ¿Qué hace el script internamente?

1) Determina el rango de fechas efectivo:
   - Día completo en la TZ configurada, o
   - Rango manual `MP_DATE_FROM`→`MP_DATE_TO` (00:00–23:59), o
   - Sin filtro si `MP_NO_DATE_FILTER=true`.
2) Consulta pagos con `payments/search` (SDK `mercadopago`) aplicando:
   - Rango de fechas (si aplica), `range` (campo de fecha) y `status` (si se definió).
   - Paginación con `limit`/`offset` hasta `MP_MAX_PAGES`.
3) Normaliza resultados y calcula totales aproximados (ingresos/devoluciones) desde pagos.
4) Genera archivos en `out/`:
   - CSV curado, CSV full (JSON aplanado), XLSX con tabla, DBF curado, JSON de resumen.
5) Envía un email con adjuntos (si SMTP configurado) y loguea la cantidad de transacciones.

Importante: `payments/search` cubre ventas/devoluciones. Retiros, transferencias, comisiones y contracargos se reflejan mejor en los reportes de finanzas/liquidaciones (futuras ampliaciones).

---

### Salidas en `out/`

- `transactions-YYYY-MM-DD.csv`: columnas operativas principales (id, fechas, estados, importes, netos, comisiones, medios de pago, pagador, POS/Store, referencias, tarjeta)
- `transactions-full-YYYY-MM-DD.csv`: JSON completo aplanado con todas las claves disponibles
- `transactions-full-YYYY-MM-DD.xlsx`: tabla Excel (filtros/ordenación)
- `transactions-detailed-YYYY-MM-DD.dbf`: esquema dBase con nombres ≤ 10 caracteres
- `balance-YYYY-MM-DD.json`: resumen rápido con totales aproximados a partir de pagos

Nota: en la app de escritorio (GUI), los archivos se generan en la carpeta `Documentos/MP-Reportes` del usuario.

Retención de archivos: conservar según política interna (p. ej. 30–90 días).

---

### Cron (Linux/WSL)

Ejemplo de programación (parciales a las 12/14/16 y cierre a las 18:05, en TZ CABA):
```cron
TZ=America/Argentina/Buenos_Aires
0 12 * * * cd /home/ismael/mp && npm run mp:payments:report:dist
0 14 * * * cd /home/ismael/mp && npm run mp:payments:report:dist
0 16 * * * cd /home/ismael/mp && npm run mp:payments:report:dist
5 18 * * *  cd /home/ismael/mp && npm run mp:payments:report:dist
```

---

### Troubleshooting

- No llega el email: verificar `SMTP_*`, `EMAIL_REPORT`, puertos/SSL y credenciales. Revisar spam.
- 401/403 desde API: credenciales inválidas o falta completar “Ir a producción” en Mercado Pago.
- Resultados vacíos: confirmar TZ y rango; probar `MP_NO_DATE_FILTER=true` como diagnóstico.
- Faltan operaciones: usar `MP_RANGE=date_last_updated` para capturar aprobaciones/actualizaciones del día.
- Archivos muy grandes: ajustar `MP_LIMIT` y `MP_MAX_PAGES`.

- Electron en WSL: instalar librerías del sistema (`libnss3`, `libgtk-3-0`, `libxss1`, `libasound2t64`, etc.) y `xdg-utils`. En Windows 11 con WSLg suele funcionar directo; de lo contrario, configurar un servidor X y `DISPLAY`.

---

### Roadmap (próximas ampliaciones)

- Reportes de Liquidaciones/Finanzas por API (crear/consultar/descargar CSV oficial de MP) y conciliación contra `payments`.
- Snapshot de saldo/balance por API (si está habilitado a nivel cuenta/país).
- Webhook de notificaciones para eventos de pagos en tiempo real.
- Exportación adicional (PDF) y dashboards.
- Logs estructurados y métricas.

---

### Licencia

Uso interno. Ajustar a la licencia de la organización si se requiere distribución.


# mp
