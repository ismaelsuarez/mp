# Flujo Caja / Administración

## Caja (emisión)
1. Confirmación de venta → construir `Comprobante` + `Emisor` + `Receptor` + `Items`.
2. Solicitar CAE (si online) → `solicitarCAE`.
3. Generar QR + PDF con plantilla → `generarFacturaPdf`.
4. Guardar registro en DB y abrir PDF.
5. Si AFIP falla, marcar `pendiente` y permitir reintento posterior.

## Administración
- Configurar Empresa (razón social, CUIT, IVA, domicilio, logo).
- Configurar AFIP (CUIT, pto vta, cert, key, entorno).
- Parámetros (tipo por defecto, pto vta, numeración).
- Historial interno: lista de comprobantes (DB) con abrir PDF.
- Historial local: lista de PDFs en `Documentos/facturas/` con abrir.

## Reintentos / Offline
- Cron/acción manual para reintentar pedir CAE de registros en `facturas_estado` `pendiente`.
- Al obtener CAE, actualizar registro definitivo e invalidar provisorio.
