# Configuración AFIP (en construcción)

Esta guía explica cómo cargar la configuración para emitir comprobantes electrónicos.

## Datos requeridos
- CUIT del emisor
- Punto de Venta (WSFE)
- Ruta del certificado (`.crt`/`.pem`)
- Ruta de la clave privada (`.key`/`.pem`)
- Entorno: `homologacion` o `produccion`

Opcionales de empresa (se usan en PDF):
- Razón social, domicilio, condición IVA, logo (ruta local de imagen)

## Dónde configurarlo en la app
- Modo Administración → sección “Facturación (AFIP) (en construcción)”
  - “Datos de la empresa”
  - “Parámetros” (tipo por defecto, Pto Vta, numeración)
  - “Configuración AFIP” (CUIT, Pto Vta, certificado, key, entorno)

La configuración se guarda en la base embebida (`facturas.db`).

## SDK y dependencias
- Instalar el SDK AFIP: `afip.js` (se carga de forma diferida). Si falta, la app no crashea, pero no se podrá pedir CAE.
- Otras dependencias: `better-sqlite3`, `handlebars`, `puppeteer`, `qrcode` (ya incluidas en el instalador del proyecto).

## Certificado y clave
- Generar conforme la guía de AFIP (WSAA/WSFE)
- Guardar rutas absolutas en la configuración (ej.: `C:\\certs\\afip.pem`, `C:\\certs\\afip.key`)
- Asegurar permisos de lectura para el usuario que ejecuta la app

## Validaciones rápidas
- CUIT numérico y de 11 dígitos
- Pto Vta entero > 0
- Archivos de `cert_path` y `key_path` existen y son legibles
- Entorno correcto

## Seguridad
- Las rutas a archivos quedan en disco local; si se usan compartidos, preferir UNC (`\\\\servidor\\carpeta\\archivo.pem`).
- No compartir llave privada ni subir a repositorios.
