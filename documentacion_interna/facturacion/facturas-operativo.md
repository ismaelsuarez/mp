## Facturación – Operativa unificada (FA/FB/NCA/NCB/NDA/NDB)

### Diagrama de flujo (disparo .fac)
```mermaid
flowchart TD
  A[Watcher .fac] --> B[Encolar archivo]
  B --> C[Processor: validar NTP]
  C -->|válido| D[AFIP emitir (retry x3)]
  C -->|drift| Z1[Log drift y conservar .fac]
  D -->|OK| E[PDF + QR]
  D -->|Falla| Z2[Log AFIP_ERROR y conservar .fac]
  E --> F[Copias Local/Red1/Red2]
  F --> G[Impresión (si COPIAS>0)]
  G --> H[Email (si EMAIL:)]
  H --> I[WhatsApp (si WHATSAPP:)]
  I --> J[Generar .res por tipo]
  J --> K[Enviar .res (retry x3)]
  K -->|OK| L[Borrar .res y .fac]
  K -->|Falla| Z3[Conservar .res y .fac; log]
```

### Orden de post‑acciones (tras AFIP OK)
1. PDF (pdfRenderer + invoiceLayout.mendoza; QR y datos fiscales)
2. Copias a `outLocal/outRed1/outRed2` (creación recursiva de carpetas)
3. Impresión silenciosa (si COPIAS>0); si impresora no existe, usar predeterminada
4. Email (si EMAIL:) adjuntando PDF
5. WhatsApp: crear `wfa*.txt` y enviar junto al PDF; al confirmar, borrar `wfa*.txt`
6. `.res` exacto por tipo y envío FTP/SFTP con reintentos; sólo si OK borrar `.res` y `.fac`

### `.res` por tipo
- Sufijos: FA→a, FB→b, NCA→c, NCB→d, NDA→e, NDB→f
- Contenido: punto de venta, número, fecha, CAE/vence, importe total, referencia `.fac` y nombre de PDF

### Logs
- Estructurados (JSON) por comprobante en `userData/logs/facturas-YYYYMMDD.log`
- Campos: tipo, pv, número, facPath, pdfPath, resPath, email/wa presentes, impresora usada, tiempos por etapa, resultado
- No loguear credenciales

### Tabla de errores frecuentes
| Error | Causa probable | Acción | Se borra .fac |
|---|---|---|---|
| TIME_DRIFT | Hora fuera de tolerancia NTP | Corregir hora/equipo/NTP; reintentar | No |
| AFIP_ERROR | Falla emisión (red/AFIP) tras 3 reintentos | Ver conectividad/credenciales; reintentar | No |
| PDF_FAIL | Error en render/plantilla/fondo | Revisar `invoiceLayout`/fondos; reintentar | No |
| PRINT_FAIL | Impresora no válida o colada | Ver impresora/driver; continúa flujo | — |
| EMAIL_FAIL | SMTP/config inválida | Revisar EmailService/config | — |
| WA_FAIL | SFTP/FTP WhatsApp falla | Revisar credenciales/conexión | — |
| RES_FTP_FAIL | Envío `.res` falla tras reintentos | Revisar FTP/SFTP MP; conservar `.res` y `.fac` | No |

### Notas
- La cola de `.fac` es estrictamente secuencial; no se borran archivos fuera del ítem en curso
- Los contadores por tipo se incrementan sólo si AFIP OK + PDF y `.res` enviado correctamente

—
Elaborado por: GPT‑5 (asistencia técnica)
Fecha: 19/09/2025 17:00:00


