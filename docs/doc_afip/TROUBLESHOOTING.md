# Solución de problemas (AFIP)

## “SDK AFIP no instalado”
- Instalar el paquete `afip.js` (o el SDK indicado) y reiniciar la app.

## Error de certificado/clave
- Verificar rutas absolutas y permisos de lectura.
- Validar que correspondan al CUIT configurado.

## Rechazo de comprobante
- Revisar mensaje devuelto por AFIP.
- Verificar Pto de Venta, tipo de comprobante, fecha y totales.
- Confirmar que el último número autorizado coincide con la numeración local.

## QR no se renderiza
- Revisar que `qr_data_url` esté presente en los datos y que la plantilla lo muestre.

## PDF sin logo
- Confirmar `emisor.logoPath` con ruta local válida y permisos de lectura.

## Sin conexión
- La app puede generar provisorios; al reconectar, usar el reintento para pedir CAE.
