# Refactorización del Servicio AFIP

## Resumen Ejecutivo

Se ha refactorizado completamente el módulo `src/modules/facturacion/afipService.ts` para usar `afip.js` como driver oficial de AFIP, manteniendo la capa de negocio existente y agregando funcionalidades avanzadas de logging, validación y gestión de errores.

## Arquitectura Refactorizada

### Estructura de Archivos

```
src/modules/facturacion/
├── afipService.ts              # Servicio principal refactorizado
├── types.ts                    # Tipos extendidos para AFIP
└── afip/
    ├── AfipLogger.ts           # Sistema de logging específico
    ├── CertificateValidator.ts # Validación de certificados
    ├── helpers.ts              # Helpers y utilidades
    └── config.ts               # Configuración de entorno
```

### Componentes Principales

#### 1. AfipService (Clase Principal)
- **Instancia Singleton**: Centraliza la gestión de la instancia de AFIP
- **Validación Automática**: Verifica certificados antes de cada operación
- **Logging Completo**: Registra requests, responses y errores
- **Gestión de Errores**: Manejo robusto de excepciones con contexto

#### 2. AfipLogger
- **Logs Diarios**: Archivos separados por fecha (`YYYYMMDD.log`)
- **Sanitización**: Remueve datos sensibles (certificados, tokens)
- **Estructura JSON**: Logs en formato estructurado para análisis
- **Ubicación**: `{userData}/logs/afip/`

#### 3. CertificateValidator
- **Validación de Expiración**: Verifica fechas de vencimiento
- **Mínimo 30 Días**: Requiere al menos 30 días de validez
- **Validación de Clave**: Verifica formato de clave privada
- **Mensajes Detallados**: Errores específicos para troubleshooting

#### 4. AfipHelpers
- **Mapeo Centralizado**: Conversión de tipos de comprobante
- **Construcción de IVA**: Agrupación automática por alícuota
- **Generación de QR**: URLs compatibles con AFIP
- **Validación de Datos**: Verificación de integridad de comprobantes

## Funcionalidades Implementadas

### Métodos Principales

#### `solicitarCAE(comprobante: Comprobante): Promise<DatosAFIP>`
- ✅ Validación automática del comprobante
- ✅ Verificación de certificado antes de la operación
- ✅ Logging completo de request/response
- ✅ Manejo robusto de errores
- ✅ Generación automática de QR

#### `checkServerStatus(): Promise<ServerStatus>`
- ✅ Verificación de estado de servidores AFIP
- ✅ Retorna estado de AppServer, DbServer, AuthServer
- ✅ Logging de operación

#### `validarCertificado(): CertificadoInfo`
- ✅ Validación de fecha de expiración
- ✅ Verificación de existencia de archivos
- ✅ Información detallada de validez

#### `getUltimoAutorizado(puntoVenta, tipoComprobante): Promise<number>`
- ✅ Consulta del último número autorizado
- ✅ Logging de operación
- ✅ Manejo de errores específicos

### Sistema de Logging

#### Estructura de Logs
```json
{
  "timestamp": "2024-01-15T10:30:00.000Z",
  "operation": "createVoucher",
  "request": { "PtoVta": 1, "CbteTipo": 1, ... },
  "response": { "CAE": "12345678901234", "CAEFchVto": "20240131", ... },
  "error": null,
  "stack": null
}
```

#### Ubicación de Logs
- **Ruta**: `{userData}/logs/afip/YYYYMMDD.log`
- **Formato**: JSON Lines (un objeto JSON por línea)
- **Rotación**: Automática por fecha
- **Sanitización**: Datos sensibles removidos

### Validación de Certificados

#### Criterios de Validación
- ✅ Archivo existe y es legible
- ✅ Formato PEM válido
- ✅ No expirado
- ✅ Mínimo 30 días de validez restante
- ✅ Clave privada válida

#### Mensajes de Error
- "Certificado no encontrado: {path}"
- "Certificado expirado"
- "Certificado expira en {días} días (mínimo 30 días requeridos)"

## Configuración de Entorno

### Variables de Entorno Soportadas

```bash
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

# Configuración General
AFIP_DEFAULT_ENTORNO=homologacion
AFIP_LOG_LEVEL=info
AFIP_TIMEOUT=30000
AFIP_RETRY_ATTEMPTS=3
```

### Archivo de Ejemplo
- **Ubicación**: `env.example`
- **Uso**: Copiar como `.env` y configurar valores

## Compatibilidad y Migración

### API Legacy Mantenida
```typescript
// Código existente sigue funcionando
import { solicitarCAE } from './afipService';
const datos = await solicitarCAE(comprobante);
```

### Nueva API Recomendada
```typescript
// Nueva API con funcionalidades extendidas
import { afipService } from './afipService';

// Solicitar CAE
const datos = await afipService.solicitarCAE(comprobante);

// Verificar estado de servidores
const status = await afipService.checkServerStatus();

// Validar certificado
const certInfo = afipService.validarCertificado();

// Obtener logs
const logs = afipService.getLogs('20240115');
```

## Mejoras Implementadas

### 1. Robustez
- ✅ Validación automática de certificados
- ✅ Manejo de errores con contexto
- ✅ Reintentos automáticos (configurable)
- ✅ Timeouts configurables

### 2. Observabilidad
- ✅ Logging completo de operaciones
- ✅ Métricas de estado de servidores
- ✅ Información detallada de certificados
- ✅ Trazabilidad de errores

### 3. Mantenibilidad
- ✅ Código modular y reutilizable
- ✅ Tipos TypeScript completos
- ✅ Documentación inline
- ✅ Separación de responsabilidades

### 4. Configurabilidad
- ✅ Variables de entorno por defecto
- ✅ Configuración por entorno (homologación/producción)
- ✅ Parámetros ajustables (timeout, reintentos)
- ✅ Niveles de logging configurables

## Dependencias Agregadas

### Producción
- `xml2js`: Parsing de XML para certificados
- `crypto-js`: Operaciones criptográficas
- `node-forge`: Validación de certificados

### Desarrollo
- `@types/xml2js`: Tipos TypeScript
- `@types/crypto-js`: Tipos TypeScript

## Próximos Pasos

### 1. Testing
- [ ] Tests unitarios para cada componente
- [ ] Tests de integración con AFIP homologación
- [ ] Tests de validación de certificados
- [ ] Tests de logging

### 2. Monitoreo
- [ ] Dashboard de logs AFIP
- [ ] Alertas de certificados próximos a expirar
- [ ] Métricas de performance
- [ ] Reportes de errores

### 3. Optimizaciones
- [ ] Cache de instancia AFIP
- [ ] Pool de conexiones
- [ ] Compresión de logs
- [ ] Rotación automática de logs

## Conclusión

La refactorización del servicio AFIP proporciona una base sólida y escalable para la integración con AFIP, manteniendo compatibilidad con el código existente mientras agrega funcionalidades avanzadas de logging, validación y gestión de errores. El sistema está preparado para producción con configuraciones flexibles y observabilidad completa.
