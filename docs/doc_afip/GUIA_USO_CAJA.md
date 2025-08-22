# Guía de Uso - Emisión de Facturas desde Modo Caja

## 🚀 Cómo Emitir Facturas

### 1. **Acceder al Modo Caja**
- Abrir la aplicación
- Ir a **Modo Caja** desde el menú principal

### 2. **Completar el Formulario de Facturación**
En la sección "📄 Emisión de Factura" completar:

- **CUIT Cliente**: CUIT del cliente (ej: 20300123456)
- **Razón Social**: Nombre o razón social del cliente
- **Descripción**: Descripción del servicio/producto
- **Importe Neto**: Monto sin IVA

### 3. **Emitir la Factura**
- Hacer clic en **"EMITIR FACTURA"**
- El sistema automáticamente:
  - ✅ Valida los datos ingresados
  - ✅ Calcula IVA (21%)
  - ✅ Solicita CAE a AFIP
  - ✅ Genera QR AFIP
  - ✅ Crea PDF profesional
  - ✅ Abre el PDF automáticamente

### 4. **Verificar Resultado**
- En los logs aparecerá: `✅ Factura emitida Nº X - CAE: XXXXXX`
- El PDF se abre automáticamente
- El formulario se limpia para la siguiente factura

## 📋 Ejemplo de Uso

### Datos de Entrada:
```
CUIT Cliente: 20300123456
Razón Social: Cliente Demo S.A.
Descripción: Servicio de reparación de PC
Importe Neto: 1500
```

### Resultado Automático:
```
Neto: $1,500.00
IVA (21%): $315.00
Total: $1,815.00
```

## ⚠️ Requisitos Previos

### Configuración AFIP (una sola vez):
1. Ir a **Administración** → **Configuración**
2. Sección "📄 Facturación (AFIP)"
3. Configurar:
   - Datos de la empresa
   - Certificados AFIP (.crt y .key)
   - Entorno (Homologación/Producción)

### Certificados Válidos:
- Certificado AFIP vigente
- Clave privada correspondiente
- Mínimo 30 días de validez restante

## 🔍 Troubleshooting

### Error: "Certificado inválido"
- Verificar que los certificados estén configurados
- Comprobar que no estén expirados
- Revisar rutas de archivos

### Error: "AFIP no responde"
- Verificar conexión a internet
- Comprobar estado de servidores AFIP
- Revisar logs en `{userData}/logs/afip/`

### Error: "Complete todos los campos"
- Verificar que todos los campos estén completos
- CUIT debe tener 11 dígitos
- Importe debe ser mayor a 0

## 📊 Logs y Monitoreo

### Ver Logs en Tiempo Real:
- Los logs aparecen en la sección inferior del Modo Caja
- Formato: `✅ Éxito` o `❌ Error`

### Logs Detallados:
- Ubicación: `{userData}/logs/afip/YYYYMMDD.log`
- Formato JSON para análisis

### Verificar Estado:
```javascript
// Desde consola de desarrollador:
const status = await window.api.afip.checkServerStatus();
const certInfo = await window.api.afip.validarCertificado();
```

## 🎯 Flujo de Trabajo Típico

1. **Configuración inicial** (una sola vez)
2. **Uso diario**:
   - Abrir Modo Caja
   - Completar formulario
   - Hacer clic en "EMITIR FACTURA"
   - PDF se abre automáticamente
   - Formulario se limpia

## 📁 Archivos Generados

### PDF de Factura:
- Ubicación: `Documentos/facturas/`
- Nombre: `factura_YYYYMMDD_HHMMSS.pdf`
- Contiene: QR AFIP, datos completos, diseño profesional

### Base de Datos:
- Registro en `facturas.db`
- Historial completo de emisiones
- Datos para reportes

## 🔧 Personalización

### Cambiar Empresa:
- Ir a **Administración** → **Configuración**
- Sección "Datos de la Empresa"
- Actualizar razón social, CUIT, etc.

### Cambiar Plantilla:
- Modificar archivos en `src/modules/facturacion/templates/`
- Plantillas disponibles: `factura_a.html`, `factura_b.html`, etc.

### Configurar Variables de Entorno:
- Editar archivo `.env`
- Variables disponibles en `env.example`

---

**Nota**: Esta funcionalidad requiere configuración previa de AFIP. Si no está configurado, contactar al administrador del sistema.
