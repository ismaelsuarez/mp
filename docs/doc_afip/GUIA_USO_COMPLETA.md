# Guía Completa de Uso - Facturación AFIP

## 🚀 **Introducción**

El sistema de facturación AFIP ha sido completamente refactorizado para usar `afip.js` como driver oficial, incluyendo funcionalidades avanzadas de logging, validación y gestión de errores.

## 📋 **Configuración Inicial**

### **1. Acceder a Administración**
1. Abrir la aplicación
2. Ir a **"Administración"** → **"Configuración"**
3. Buscar la sección **"📄 Facturación (AFIP)"**

### **2. Configurar Datos de la Empresa**
```
Razón Social: Mi Empresa S.A.
CUIT: 20123456789
Domicilio: Calle 123, Ciudad
Condición IVA: Responsable Inscripto
Logo: C:\ruta\logo.png
```

### **3. Configurar Parámetros AFIP**
```
CUIT Emisor: 20123456789
Punto de Venta: 1
Certificado (.crt/.pem): C:\certs\homologacion.crt
Clave privada (.key): C:\certs\homologacion.key
Entorno: Homologación
```

### **4. Guardar Configuración**
- Hacer clic en **"Guardar configuración AFIP"**
- Verificar que aparezca "Configuración guardada"

## 🧪 **Realizar Pruebas**

### **Sección de Pruebas de Facturación**
En la misma sección encontrarás:

#### **📄 Emisión de Factura de Prueba**
1. **Completar datos del cliente**:
   - CUIT Cliente: `20300123456`
   - Razón Social: `Cliente Demo S.A.`

2. **Agregar Items de la Factura**:
   - Hacer clic en **"+ Agregar Item"** para agregar productos/servicios
   - Para cada item completar:
     - **Descripción**: Nombre del producto o servicio
     - **Cantidad**: Número de unidades
     - **Precio Unitario**: Precio por unidad (sin IVA)
     - **IVA %**: Seleccionar alícuota:
       - `21%`: Productos y servicios generales
       - `10.5%`: Alimentos, libros, medicamentos
       - `27%`: Servicios de telefonía, internet
       - `0%`: Productos exentos
       - `Exento`: Servicios exentos de IVA

3. **Verificar totales**:
   - El sistema calcula automáticamente:
     - Subtotal por item
     - Total Neto
     - Total IVA (según alícuotas)
     - Total Final

4. **Emitir**: Hacer clic en **"Emitir Factura de Prueba"**
   - El sistema validará todos los datos
   - Solicitará CAE a AFIP
   - Generará PDF con QR
   - Abrirá el PDF automáticamente

#### **🛠️ Gestión de Items**
- **Agregar Item**: Botón **"+ Agregar Item"**
- **Eliminar Item**: Botón **❌** en cada fila
- **Limpiar Todo**: Botón **"Limpiar Items"**
- **Items de Ejemplo**: Se cargan automáticamente al abrir la sección

#### **✅ Verificar Estado AFIP**
- Hacer clic en **"Verificar Estado AFIP"**
- Verifica conectividad con:
  - AppServer
  - DbServer  
  - AuthServer

#### **🔒 Validar Certificado**
- Hacer clic en **"Validar Certificado"**
- Verifica:
  - Validez del certificado
  - Fecha de expiración
  - Días restantes

## 🔄 **Modo Automatización (Modo Caja)**

### **Configuración para Automatización**
El Modo Caja está preparado para recibir datos automáticamente:

#### **Función Disponible**
```javascript
window.processAutomaticBilling(data)
```

#### **Estructura de Datos**
```json
{
  "pto_vta": 1,
  "tipo_cbte": 1,
  "fecha": "20241215",
  "cuit_emisor": "20123456789",
  "cuit_receptor": "20300123456",
  "razon_social_receptor": "Cliente Demo",
  "condicion_iva_receptor": "RI",
  "neto": 1000,
  "iva": 210,
  "total": 1210,
  "detalle": [
    {
      "descripcion": "Servicio de reparación",
      "cantidad": 1,
      "precioUnitario": 1000,
      "alicuotaIva": 21
    }
  ],
  "empresa": {
    "nombre": "TODO-COMPUTACIÓN",
    "cuit": "20123456789"
  },
  "plantilla": "factura_a"
}
```

## 📊 **Características del Sistema Refactorizado**

### **✅ Nuevas Funcionalidades**

1. **Sistema de Logging Completo**
   - Logs diarios en `{userData}/logs/afip/YYYYMMDD.log`
   - Registro de requests y responses
   - Sanitización automática de datos sensibles

2. **Validación Automática de Certificados**
   - Verificación antes de cada operación
   - Alertas cuando faltan menos de 30 días para expirar

3. **Verificación de Estado de Servidores**
   - Monitoreo en tiempo real de AFIP
   - Estado de AppServer, DbServer y AuthServer

4. **Manejo Robusto de Errores**
   - Contexto completo de errores
   - Stack traces detallados
   - Reintentos automáticos configurables

5. **Configuración por Variables de Entorno**
   - Archivo `env.example` con configuración por defecto
   - Soporte para homologación y producción

### **🛠️ Arquitectura Modular**

```
src/modules/facturacion/
├── afipService.ts              # Servicio principal refactorizado
├── types.ts                    # Tipos extendidos
└── afip/
    ├── AfipLogger.ts           # Sistema de logging
    ├── CertificateValidator.ts # Validación de certificados
    ├── helpers.ts              # Utilidades y mapeos
    └── config.ts               # Configuración de entorno
```

## 📊 **Alicuotas de IVA Soportadas**

### **Tipos de Alícuotas Disponibles**

| Alícuota | Descripción | Uso Típico |
|----------|-------------|------------|
| **21%** | IVA General | Productos y servicios generales, electrónica, reparaciones |
| **10.5%** | IVA Reducido | Alimentos, libros, medicamentos, transporte público |
| **27%** | IVA Especial | Servicios de telefonía, internet, cable, algunos combustibles |
| **0%** | Sin IVA | Productos exentos (exportaciones, algunos medicamentos) |
| **Exento** | Exento de IVA | Servicios exentos (educación, salud pública, etc.) |

### **Ejemplos de Uso por Rubro**

#### **🖥️ Informática y Tecnología**
- **Productos**: Mouse, teclados, monitores → **21%**
- **Servicios**: Reparación PC, mantenimiento → **21%**
- **Software**: Licencias, desarrollo → **21%**

#### **📚 Educación y Cultura**
- **Libros**: Textos, manuales → **10.5%**
- **Cursos**: Capacitación, talleres → **21%**
- **Material educativo**: Útiles escolares → **21%**

#### **🏥 Salud y Farmacia**
- **Medicamentos**: Recetados → **10.5%**
- **Servicios médicos**: Consultas, tratamientos → **21%**
- **Equipamiento**: Instrumentos médicos → **21%**

#### **🍽️ Alimentación**
- **Alimentos**: Comestibles básicos → **10.5%**
- **Restaurantes**: Comidas preparadas → **21%**
- **Bebidas**: Gaseosas, alcohol → **21%**

## 🔧 **Configuración Avanzada**

### **Variables de Entorno (.env)**
```env
# Homologación
AFIP_HOMOLOGACION_CUIT=20123456789
AFIP_HOMOLOGACION_PTO_VTA=1
AFIP_HOMOLOGACION_CERT_PATH=C:/certs/homologacion.crt
AFIP_HOMOLOGACION_KEY_PATH=C:/certs/homologacion.key

# Producción
AFIP_PRODUCCION_CUIT=20123456789
AFIP_PRODUCCION_PTO_VTA=1
AFIP_PRODUCCION_CERT_PATH=C:/certs/produccion.crt
AFIP_PRODUCCION_KEY_PATH=C:/certs/produccion.key

# General
AFIP_DEFAULT_ENTORNO=homologacion
AFIP_LOG_LEVEL=info
AFIP_TIMEOUT=30000
AFIP_RETRY_ATTEMPTS=3
```

## 📈 **Monitoreo y Logs**

### **Ubicación de Logs**
- **Ruta**: `{AppData}/logs/afip/`
- **Formato**: `YYYYMMDD.log`
- **Contenido**: JSON estructurado

### **Estructura de Log**
```json
{
  "timestamp": "2024-12-15T10:30:00.000Z",
  "operation": "solicitarCAE",
  "request": { "..." },
  "response": { "..." },
  "duration": 1250
}
```

## ⚠️ **Resolución de Problemas**

### **Errores Comunes**

1. **"SDK AFIP no instalado"**
   - Verificar instalación de `afip.js`
   - Reinstalar: `npm install afip.js`

2. **"Certificado no encontrado"**
   - Verificar rutas en configuración
   - Comprobar permisos de archivos

3. **"Error de conexión AFIP"**
   - Verificar conectividad a internet
   - Usar "Verificar Estado AFIP" en pruebas

4. **"Certificado vencido"**
   - Renovar certificado con AFIP
   - Actualizar rutas en configuración

### **Logs de Depuración**
Revisar logs diarios para obtener información detallada sobre errores y operaciones.

## 📞 **Soporte**

Para problemas técnicos contactar:
- **Email**: pc@tcmza.com.ar
- **WhatsApp**: 26154669355
- **Teléfono**: 0261 4201555 int. 2

---

**Versión**: 1.0.0 Refactorizado  
**Fecha**: Diciembre 2024  
**Estado**: ✅ **PRODUCCIÓN READY**
