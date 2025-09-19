## Facturas A/B y Notas (Crédito/Débito) – Flujo unificado

Este documento resume cómo funciona la emisión de Facturas y Notas desde la UI y por disparo de archivos `.fac`, usando la misma clase y post‑acciones, y cómo diagnosticar problemas en ambiente compilado (.exe).

### Componentes clave
- Clase unificada: `src/modules/facturacion/FacturaElectronicaProcessor.ts`
  - Detecta tipo (FA/FB/NCA/NCB/NDA/NDB) a partir del `.fac`.
  - Emite con AFIP (servicio existente) y genera PDF con `src/pdfRenderer.ts` usando `src/invoiceLayout.mendoza.ts`.
  - Post‑acciones: nombres PDF por tipo, copias a Local/Red1/Red2, impresión, email/WhatsApp y `.res`.
- Watcher `.fac`: `src/main.ts`
  - Directorio por defecto: `C:\tmp` (siempre activo).
  - Encola y procesa secuencialmente (`processFacQueue`).
- UI Configuración: `public/config.html`
  - Panel “Facturas A/B y Notas” (rutas de salida, impresora, últimos PDFs, abrir carpetas/manejo básico).
  - “Pruebas de Facturación”: emite por `window.api.facturas.emitirUi(...)` => mismo pipeline.
- IPC/UI Bridge: `src/main.ts` + `src/preload.ts`
  - `facturas:get-config` / `facturas:save-config` (persisten en `userData/config/facturas.config.json`).
  - `facturas:emitir-ui` (construye un `.fac` temporal y llama al Processor).
  - Utilidades: `facturacion:pdfs`, `facturacion:abrir-pdf`, `open-path`.
- Config persistente: `app.getPath('userData')/config/facturas.config.json`
  - Campos: `pv`, `outLocal`, `outRed1`, `outRed2`, `printerName`, y contadores por tipo.

### Flujo por UI
1) Configurar en “Facturas A/B y Notas”: PV, rutas Local/Red y (opcional) impresora.
2) En “Pruebas de Facturación”, completar cliente/totales y presionar “Emitir Factura de Prueba”.
3) La UI llama `window.api.facturas.emitirUi(payload)` → IPC `facturas:emitir-ui` arma un `.fac` temporal y llama a `FacturaElectronicaProcessor`.
4) Se generan: PDF en `outLocal` con nombre por tipo, copias a Red1/Red2, impresión opcional, `.res` y envíos opcionales (email/WA).

### Flujo por .fac (FTP)
1) Llega archivo `.fac` al directorio observado (`C:\tmp`, o adicionales si se configuró FTP Server).
2) El watcher en `src/main.ts` encola el archivo y llama a `FacturaElectronicaProcessor`.
3) Mismas post‑acciones que en UI.

### Nombres y rutas
- Estructura: `Ventas_PV{pv}/F{YYYYMM}` dentro de cada salida.
- Nombres PDF: `FA_`, `FB_`, `NCA_`, `NCB_`, `NDA_`, `NDB_` + `{PVStr}-{NumeroStr}.pdf` (PV 4 dígitos, número 8 dígitos).
- `.res`: se genera junto al `.fac` con sufijo por letra (A→`a`, B→`b`). Se adjunta la respuesta AFIP y referencia al PDF.

### Fondos, fuentes y QR
- `FONDO:` en `.fac`: primero intenta la ruta literal; si no, busca por nombre en `templates` del app compilado; fallback `public/Noimage.jpg`.
- Fuentes: `pdfRenderer.ts` resuelve `pdf.config.json` en `userData/config` y fallbacks a Consolas empaquetadas. Si no hay fuentes, usa Helvetica.
- QR: usa `qrDataUrl` del servicio AFIP o genera un QR simple con datos mínimos.

### Email y WhatsApp
- Email: si el `.fac` incluye `EMAIL:`, intenta enviar con `src/services/EmailService.ts` adjuntando el PDF.
- WhatsApp: si incluye `WHATSAPP:`, crea un `.txt` `wfa*.txt` y lo envía junto al PDF por el canal de WhatsApp (SFTP/FTP según config). Limpia el `.txt` auxiliar tras envío.

### Diagnóstico en compilado (.exe)
- WSDLs/tickets: gestionados por `CompatAfip` para que se ubiquen correctamente (WSDLs empaquetados, tickets en `userData/afip/tickets`).
- Watcher: verificar `C:\tmp` y permisos; el watcher siempre está activo por defecto.
- Rutas de salida: abrir desde UI (botones Abrir Local/Red1/Red2) para validar accesos.
- Fuentes/fondos: confirmar que existan en el paquete (`resources/app/...`) o referencias válidas; si no, se aplica fallback.

### Limpieza de legado
- Eliminado `facturaAProcessor.ts` y sus IPCs `facturaA:*`.
- La UI usa `window.api.facturas.*` y emisión unificada.

### Próximos pasos sugeridos
- Tests E2E: 6 `.fac` (FA/FB/NCA/NCB/NDA/NDB) y dos emisiones por UI (FA/NCA).
- Ajustes `.res`: si es necesario, alinear formato exactamente con el sistema previo.
- UI: mostrar contadores por tipo y “Reset/Sync” con AFIP si aplica.


