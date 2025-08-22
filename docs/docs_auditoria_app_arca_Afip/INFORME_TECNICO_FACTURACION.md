# INFORME TÉCNICO COMPLETO - MÓDULO DE FACTURACIÓN

## 1. RESUMEN EJECUTIVO

El módulo de facturación es un sistema integral de emisión de comprobantes electrónicos AFIP integrado en la aplicación Electron. Permite la generación de facturas A/B, notas de crédito y recibos con validación CAE y generación automática de PDFs.

## 2. ARQUITECTURA DEL MÓDULO

### 2.1 Estructura de Archivos
```
src/modules/facturacion/
├── types.ts              # Definiciones de tipos TypeScript
├── afipService.ts        # Servicio de integración AFIP
├── facturaGenerator.ts   # Generador de PDFs
└── templates/            # Plantillas HTML
    ├── factura_a.html
    ├── factura_b.html
    ├── nota_credito.html
    └── recibo.html
```

### 2.2 Dependencias Principales
- **afip.js**: SDK oficial para integración con AFIP (carga diferida)
- **handlebars**: Motor de plantillas HTML
- **puppeteer**: Generación de PDFs desde HTML
- **qrcode**: Generación de códigos QR AFIP
- **dayjs**: Manipulación de fechas

## 3. ANÁLISIS DETALLADO POR COMPONENTE

### 3.1 Tipos de Datos (`types.ts`)

#### Estructuras Principales:
- **Emisor**: Datos de la empresa emisora (razón social, CUIT, domicilio, condición IVA)
- **Receptor**: Datos del cliente (nombre, documento, condición IVA)
- **Item**: Líneas de factura (descripción, cantidad, precio unitario, IVA)
- **Comprobante**: Metadatos del comprobante (tipo, punto de venta, número, fecha)
- **DatosAFIP**: Información de validación (CAE, vencimiento, QR)

#### Tipos de Comprobantes Soportados:
- `FA`: Factura A
- `FB`: Factura B  
- `NC`: Nota de Crédito
- `RECIBO`: Recibo

### 3.2 Servicio AFIP (`afipService.ts`)

#### Funcionalidades Principales:
- **Carga diferida del SDK**: Evita crashes si `afip.js` no está instalado
- **Mapeo de tipos**: Conversión de tipos internos a códigos AFIP
- **Solicitud de CAE**: Proceso completo de validación con AFIP
- **Generación de QR**: Construcción de URL QR para verificación

#### Flujo de Solicitud CAE:
1. Validación de configuración AFIP
2. Obtención del último número de comprobante
3. Cálculo de bases imponibles por alícuota IVA
4. Construcción del request AFIP
5. Envío y procesamiento de respuesta
6. Generación de datos QR

### 3.3 Generador de PDFs (`facturaGenerator.ts`)

#### Proceso de Generación:
1. **Resolución de plantilla**: Selección automática según tipo de comprobante
2. **Compilación Handlebars**: Renderizado de datos en plantilla HTML
3. **Generación QR**: Creación de imagen QR si hay datos AFIP
4. **Conversión a PDF**: Uso de Puppeteer para renderizado final
5. **Almacenamiento**: Guardado en `Documentos/facturas/`

#### Configuración PDF:
- Formato: A4
- Márgenes: 12mm en todos los lados
- Fondo: Incluido
- Modo: Headless

### 3.4 Plantillas HTML

#### Características:
- **Responsive**: Diseño adaptable con CSS Grid
- **Profesional**: Estilo corporativo con logo y datos estructurados
- **Completas**: Incluyen todos los campos requeridos por AFIP
- **QR integrado**: Posicionamiento fijo en esquina inferior derecha

#### Estructura Común:
- Header con datos del emisor y logo
- Grid de información (receptor + comprobante)
- Tabla de items con cálculos
- Sección de totales
- QR AFIP (si aplica)

## 4. INTEGRACIÓN CON EL SISTEMA

### 4.1 Servicios de Alto Nivel
- **FacturacionService**: Orquestación completa del proceso
- **DbService**: Persistencia de configuración y historial
- **IPC Handlers**: Comunicación entre procesos Electron

### 4.2 Endpoints IPC Disponibles:
```typescript
// Emisión
'facturacion:emitir'
// Listado
'facturacion:listar'
// Gestión PDFs
'facturacion:abrir-pdf'
'facturacion:pdfs'
// Configuración empresa
'facturacion:empresa:get'
'facturacion:empresa:save'
// Parámetros
'facturacion:param:get'
'facturacion:param:save'
```

### 4.3 Base de Datos
- **Tabla**: `configuracion_afip`
- **Campos**: CUIT, punto de venta, certificado, clave, entorno
- **Almacenamiento**: SQLite embebido con fallback JSON

## 5. FLUJO DE TRABAJO COMPLETO

### 5.1 Emisión de Factura
1. **Entrada de datos**: Captura desde interfaz de usuario
2. **Validación**: Verificación de datos requeridos
3. **Solicitud CAE**: Comunicación con AFIP (si está configurado)
4. **Generación PDF**: Renderizado con plantilla correspondiente
5. **Almacenamiento**: Guardado local y en base de datos
6. **Retorno**: Ruta del archivo PDF generado

### 5.2 Modo Offline
- Generación de comprobantes provisorios sin CAE
- Validación posterior cuando se configure AFIP
- Almacenamiento de datos para procesamiento diferido

## 6. CONFIGURACIÓN REQUERIDA

### 6.1 Datos de Empresa
- Razón social
- CUIT
- Domicilio fiscal
- Condición IVA
- Logo (opcional)

### 6.2 Configuración AFIP
- Certificado digital (.crt)
- Clave privada (.key)
- Punto de venta
- Entorno (testing/producción)

### 6.3 Parámetros de Facturación
- Numeración automática
- Formatos de fecha
- Configuración de plantillas

## 7. ESTADO ACTUAL Y LIMITACIONES

### 7.1 Estado: En Construcción
- Módulo base implementado y funcional
- Integración con interfaz de administración
- Documentación completa disponible

### 7.2 Limitaciones Conocidas:
- SDK AFIP requiere instalación manual
- Validación de certificados pendiente
- Integración con modo caja en desarrollo

### 7.3 Próximas Mejoras:
- Validación automática de certificados
- Integración completa con ventas
- Reportes y estadísticas
- Exportación masiva

## 8. CONSIDERACIONES TÉCNICAS

### 8.1 Seguridad
- Certificados almacenados localmente
- Validación de datos de entrada
- Manejo seguro de errores AFIP

### 8.2 Rendimiento
- Carga diferida de dependencias pesadas
- Generación asíncrona de PDFs
- Almacenamiento optimizado

### 8.3 Compatibilidad
- Soporte para múltiples tipos de comprobante
- Plantillas personalizables
- Configuración flexible

## 9. CÓDIGO DE EJEMPLO

### 9.1 Emisión de Factura
```typescript
const facturaData: FacturaData = {
  emisor: {
    razonSocial: "Mi Empresa S.A.",
    cuit: "20-12345678-9",
    condicionIVA: "RI"
  },
  receptor: {
    nombre: "Cliente Ejemplo",
    documento: "20-98765432-1",
    condicionIVA: "RI"
  },
  comprobante: {
    tipo: "FA",
    puntoVenta: 1,
    numero: 1,
    fecha: "20241201",
    items: [{
      descripcion: "Producto ejemplo",
      cantidad: 1,
      precioUnitario: 1000,
      iva: 21
    }],
    totales: {
      neto: 1000,
      iva: 210,
      total: 1210
    }
  }
};

const pdfPath = await generarFacturaPdf(facturaData);
```

### 9.2 Solicitud de CAE
```typescript
const datosAFIP = await solicitarCAE(comprobante);
// Retorna: { cae: "12345678901234", vencimientoCAE: "20241231", qrData: "..." }
```

## 10. TROUBLESHOOTING

### 10.1 Errores Comunes
- **SDK AFIP no instalado**: Instalar `afip.js` con `npm install afip.js`
- **Certificados inválidos**: Verificar formato y permisos de archivos
- **Error de conexión AFIP**: Verificar configuración de red y certificados
- **PDF no generado**: Verificar permisos de escritura en Documentos

### 10.2 Logs y Debugging
- Errores se registran en la consola de Electron
- Archivos temporales en `tmp/` durante generación
- Logs de AFIP disponibles en respuesta de error

## 11. CONCLUSIÓN

El módulo de facturación representa una solución completa y profesional para la emisión de comprobantes electrónicos AFIP. Su arquitectura modular permite fácil mantenimiento y extensión, mientras que la integración con el sistema principal asegura una experiencia de usuario coherente.

El estado actual permite operación básica con potencial para expansión completa en futuras versiones.

---

**Fecha de generación**: Diciembre 2024  
**Versión del módulo**: En construcción  
**Responsable técnico**: Equipo de desarrollo MP
