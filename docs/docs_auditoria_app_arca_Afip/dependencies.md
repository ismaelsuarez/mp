# Mapa de Dependencias - Módulo de Facturación AFIP

## Dependencias Directas

### Core Dependencies
```json
{
  "@afipsdk/afip.js": "^1.0.0",        // ✅ Driver oficial AFIP
  "node-forge": "^1.3.1",              // Validación de certificados
  "@types/node-forge": "^1.3.14",      // Tipos TypeScript para node-forge
  "dayjs": "^1.11.13",                 // Manipulación de fechas
  "qrcode": "^1.5.4",                  // Generación de códigos QR AFIP
  "handlebars": "^4.7.8",              // Motor de plantillas HTML
  "puppeteer": "^22.15.0",             // Generación de PDFs desde HTML
  "better-sqlite3": "^9.6.0"           // Base de datos local SQLite
}
```

### Dependencias de Desarrollo
```json
{
  "@types/node": "^24.2.1",            // Tipos TypeScript para Node.js
  "typescript": "^5.9.2",              // Compilador TypeScript
  "prettier": "^3.6.2"                 // Formateo de código
}
```

## Dependencias Indirectas

### node-forge
- **Propósito**: Validación de certificados X.509
- **Uso**: `CertificateValidator.validateCertificate()`
- **Alternativas**: `crypto`, `openssl`

### dayjs
- **Propósito**: Manipulación de fechas y zonas horarias
- **Uso**: Formateo de fechas para AFIP, cálculos de vencimiento
- **Alternativas**: `moment.js`, `date-fns`, `luxon`

### qrcode
- **Propósito**: Generación de códigos QR para AFIP
- **Uso**: `buildQrAfipUrl()` en helpers
- **Alternativas**: `qrcode-generator`, `jsqr`

### handlebars
- **Propósito**: Motor de plantillas para PDFs
- **Uso**: Plantillas HTML de facturas
- **Alternativas**: `ejs`, `pug`, `mustache`

### puppeteer
- **Propósito**: Generación de PDFs desde HTML
- **Uso**: `FacturaGenerator.generarPdf()`
- **Alternativas**: `wkhtmltopdf`, `chrome-headless`, `playwright`

### better-sqlite3
- **Propósito**: Base de datos local para persistencia
- **Uso**: Almacenamiento de facturas y configuración
- **Alternativas**: `sqlite3`, `lowdb`, `nedb`

## Dependencias del Sistema

### Electron
- **Propósito**: Framework de aplicación de escritorio
- **Uso**: IPC, gestión de archivos, interfaz de usuario
- **Versión**: ^30.0.0

### Node.js
- **Propósito**: Runtime de JavaScript
- **Uso**: Sistema de archivos, HTTP, crypto
- **Versión**: ^24.2.1 (tipos)

## Dependencias Opcionales

### ARCA/Provincial (No implementado)
```json
{
  "arca-sdk": "NO IMPLEMENTADO",       // SDK para ARCA
  "provincial-api": "NO IMPLEMENTADO"  // APIs provinciales
}
```

## Análisis de Vulnerabilidades

### Dependencias Críticas
- **afip.js**: NO INSTALADO - Bloqueo total de funcionalidad
- **node-forge**: Vulnerabilidades conocidas en versiones anteriores
- **puppeteer**: Dependencia pesada, requiere Chrome

### Dependencias Seguras
- **dayjs**: Biblioteca ligera y segura
- **qrcode**: Sin vulnerabilidades conocidas
- **handlebars**: Ampliamente utilizada y mantenida

## Recomendaciones

### Inmediatas
1. **Instalar afip.js**: `npm install @afipsdk/afip.js`
2. **Actualizar node-forge**: Verificar versión más reciente
3. **Auditar dependencias**: `npm audit`

### A Mediano Plazo
1. **Evaluar alternativas**: Considerar librerías más ligeras
2. **Bundle analysis**: Analizar tamaño del bundle
3. **Tree shaking**: Optimizar imports

### A Largo Plazo
1. **Monitoreo continuo**: Implementar dependabot
2. **Vulnerability scanning**: Integrar en CI/CD
3. **Backup dependencies**: Planificar alternativas

## Instalación

```bash
# Instalar dependencias críticas
npm install afip.js

# Instalar dependencias de desarrollo
npm install --save-dev @types/node-forge

# Verificar instalación
npm list afip.js
npm audit
```

## Configuración

### Variables de Entorno Requeridas
```bash
# AFIP Configuration
AFIP_HOMOLOGACION_CUIT=20123456789
AFIP_HOMOLOGACION_CERT_PATH=/path/to/cert.crt
AFIP_HOMOLOGACION_KEY_PATH=/path/to/key.key

# Optional
AFIP_LOG_LEVEL=info
AFIP_TIMEOUT=30000
```

### Certificados Requeridos
- **Certificado AFIP**: Archivo .crt o .pem
- **Clave privada**: Archivo .key
- **Permisos**: 600 (solo propietario)

## Troubleshooting

### Error: "SDK AFIP no instalado"
```bash
npm install @afipsdk/afip.js
```

### Error: "Certificado inválido"
```bash
# Verificar certificado
openssl x509 -in cert.crt -noout -text

# Verificar permisos
ls -la cert.crt key.key
```

### Error: "Dependencia no encontrada"
```bash
# Limpiar cache
npm cache clean --force

# Reinstalar
rm -rf node_modules package-lock.json
npm install
```
