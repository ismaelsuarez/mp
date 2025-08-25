# 🧪 GUÍA COMPLETA DE TESTING - MÓDULO FACTURACIÓN

## 📋 ÍNDICE
1. [Estructura de Tests](#estructura-de-tests)
2. [Comandos de Ejecución](#comandos-de-ejecución)
3. [Tipos de Tests](#tipos-de-tests)
4. [Configuración](#configuración)
5. [Ejemplos de Uso](#ejemplos-de-uso)
6. [Cobertura de Código](#cobertura-de-código)
7. [Troubleshooting](#troubleshooting)
8. [Homologación AFIP](#homologación-afip)

---

## 🏗️ ESTRUCTURA DE TESTS

### **📁 Organización de Archivos:**
```
src/modules/facturacion/__tests__/
├── 📄 README.md                    # Documentación de tests
├── 📁 unit/                       # Tests unitarios
│   ├── 🧪 AfipValidator.test.ts
│   ├── 🧪 IdempotencyManager.test.ts
│   └── 🧪 TimeValidator.test.ts
├── 📁 integration/                # Tests de integración
│   └── 🧪 afipService.test.ts
├── 📁 homologacion/              # Tests de homologación
│   └── 🧪 afip-homologacion.test.ts
├── 📁 fixtures/                  # Datos de prueba
│   └── 📄 mocks.ts
├── 📄 setup.ts                   # Configuración general
├── 📄 setup-integration.ts       # Configuración integración
├── 📄 setup-homologacion.ts      # Configuración homologación
└── 📄 env-setup.ts              # Variables de entorno
```

### **📄 Archivos de Configuración:**
- **`jest.config.js`**: Configuración principal de Jest
- **`.env.homologacion`**: Variables para tests de homologación
- **`tsconfig.json`**: Configuración TypeScript para tests

---

## 🚀 COMANDOS DE EJECUCIÓN

### **📋 Comandos Principales:**

```bash
# 🧪 Ejecutar todos los tests
npm test

# 🧪 Tests unitarios
npm run test:unit

# 🧪 Tests de integración
npm run test:integration

# 🧪 Tests de homologación
npm run test:homologacion

# 🧪 Tests con cobertura
npm run test:coverage

# 🧪 Tests en modo watch (desarrollo)
npm run test:watch

# 🧪 Tests con debug
npm run test:debug

# 🧪 Tests en CI/CD
npm run test:ci
```

### **🔧 Comandos Avanzados:**

```bash
# Ejecutar tests específicos por patrón
npm test -- --testNamePattern="validar comprobante"

# Ejecutar tests con verbose
npm test -- --verbose

# Ejecutar tests con timeout personalizado
npm test -- --testTimeout=60000

# Ejecutar tests y generar reporte HTML
npm run test:coverage -- --coverageReporters=html

# Ejecutar tests de un archivo específico
npm test -- src/modules/facturacion/__tests__/unit/AfipValidator.test.ts
```

---

## 🎯 TIPOS DE TESTS

### **1. 🧪 Tests Unitarios (`unit/`)**

**Propósito:** Probar funciones y clases individuales de forma aislada.

**Ubicación:** `src/modules/facturacion/__tests__/unit/`

**Ejemplos:**
- `AfipValidator.test.ts` - Validación de parámetros AFIP
- `IdempotencyManager.test.ts` - Control de duplicados
- `TimeValidator.test.ts` - Validación de tiempo NTP

**Características:**
- ✅ Mocks completos de dependencias
- ✅ Tests rápidos (< 1 segundo cada uno)
- ✅ Cobertura alta de código
- ✅ Aislamiento total

### **2. 🔗 Tests de Integración (`integration/`)**

**Propósito:** Probar la interacción entre múltiples componentes.

**Ubicación:** `src/modules/facturacion/__tests__/integration/`

**Ejemplos:**
- `afipService.test.ts` - Flujo completo de emisión

**Características:**
- 🔄 Base de datos en memoria
- 🔄 Mocks parciales de servicios externos
- 🔄 Tests más lentos (5-10 segundos)
- 🔄 Validación de flujos completos

### **3. 🌐 Tests de Homologación (`homologacion/`)**

**Propósito:** Probar con servicios reales de AFIP (entorno de prueba).

**Ubicación:** `src/modules/facturacion/__tests__/homologacion/`

**Ejemplos:**
- `afip-homologacion.test.ts` - Emisión real con AFIP

**Características:**
- 🌐 Conexión real a AFIP
- 🌐 Certificados reales de prueba
- 🌐 Tests lentos (30-60 segundos)
- 🌐 Validación de integración completa

---

## ⚙️ CONFIGURACIÓN

### **🔧 Configuración de Jest (`jest.config.js`):**

```javascript
module.exports = {
  preset: 'ts-jest',
  testEnvironment: 'node',
  roots: ['<rootDir>/src'],
  testMatch: [
    '**/__tests__/**/*.test.ts',
    '**/?(*.)+(spec|test).ts'
  ],
  
  // Configuración de TypeScript
  transform: {
    '^.+\\.ts$': ['ts-jest', {
      tsconfig: 'tsconfig.json'
    }]
  },
  
  // Configuración de cobertura
  collectCoverage: true,
  coverageDirectory: 'coverage',
  coverageReporters: ['html', 'json', 'text', 'lcov'],
  
  // Archivos a incluir en cobertura
  collectCoverageFrom: [
    'src/modules/facturacion/**/*.ts',
    '!src/modules/facturacion/**/*.d.ts',
    '!src/modules/facturacion/__tests__/**'
  ],
  
  // Setup
  setupFilesAfterEnv: ['<rootDir>/src/modules/facturacion/__tests__/setup.ts'],
  
  // Timeout
  testTimeout: 30000,
  
  // Reportes
  reporters: [
    'default',
    [
      'jest-html-reporters',
      {
        publicPath: './coverage/html-report',
        filename: 'report.html'
      }
    ]
  ]
};
```

### **🌍 Variables de Entorno (`.env.homologacion`):**

```bash
# Configuración para tests de homologación AFIP
NODE_ENV=homologacion
AFIP_ENTORNO=homologacion

# Credenciales AFIP de homologación
AFIP_CUIT_HOMOLOGACION=20123456789
AFIP_CERT_PATH_HOMOLOGACION=./certificados/homologacion.crt
AFIP_KEY_PATH_HOMOLOGACION=./certificados/homologacion.key

# Configuración de NTP
NTP_SERVER=pool.ntp.org
NTP_PORT=123
NTP_ALLOWED_DRIFT=60000
NTP_TIMEOUT=5000

# Configuración de idempotencia
IDEMPOTENCY_CLEANUP_DAYS=30
IDEMPOTENCY_RETRY_DELAY=1000

# Configuración de resiliencia
AFIP_TIMEOUT=30000
AFIP_MAX_RETRIES=3
CIRCUIT_BREAKER_THRESHOLD=5
CIRCUIT_BREAKER_TIMEOUT=60000

# Configuración de base de datos
DB_PATH=./test-homologacion.db

# Configuración de logging
LOG_LEVEL=debug
LOG_TO_FILE=true

# Configuración de timezone
TZ=America/Argentina/Buenos_Aires

# Configuración de provincial
PROVINCIAL_MENDOZA_ENABLED=true
PROVINCIAL_MENDOZA_ENDPOINT=https://atm.mendoza.gov.ar/ws
PROVINCIAL_MENDOZA_TIMEOUT=30000
```

---

## 💡 EJEMPLOS DE USO

### **🧪 Ejemplo 1: Ejecutar Tests Unitarios**

```bash
# Ejecutar todos los tests unitarios
npm run test:unit

# Salida esperada:
# PASS src/modules/facturacion/__tests__/unit/AfipValidator.test.ts
# PASS src/modules/facturacion/__tests__/unit/IdempotencyManager.test.ts
# PASS src/modules/facturacion/__tests__/unit/TimeValidator.test.ts
# 
# Test Suites: 3 passed, 3 total
# Tests:       15 passed, 15 total
# Snapshots:   0 total
# Time:        5.234 s
```

### **🔗 Ejemplo 2: Ejecutar Tests de Integración**

```bash
# Ejecutar tests de integración
npm run test:integration

# Salida esperada:
# PASS src/modules/facturacion/__tests__/integration/afipService.test.ts
# 
# Test Suites: 1 passed, 1 total
# Tests:       8 passed, 8 total
# Snapshots:   0 total
# Time:        12.456 s
```

### **🌐 Ejemplo 3: Ejecutar Tests de Homologación**

```bash
# Ejecutar tests de homologación
npm run test:homologacion

# Salida esperada:
# PASS src/modules/facturacion/__tests__/homologacion/afip-homologacion.test.ts
# 
# Test Suites: 1 passed, 1 total
# Tests:       5 passed, 5 total
# Snapshots:   0 total
# Time:        45.123 s
```

### **📊 Ejemplo 4: Generar Reporte de Cobertura**

```bash
# Ejecutar tests con cobertura
npm run test:coverage

# Salida esperada:
# PASS src/modules/facturacion/__tests__/unit/AfipValidator.test.ts
# PASS src/modules/facturacion/__tests__/unit/IdempotencyManager.test.ts
# PASS src/modules/facturacion/__tests__/unit/TimeValidator.test.ts
# PASS src/modules/facturacion/__tests__/integration/afipService.test.ts
# 
# Test Suites: 4 passed, 4 total
# Tests:       28 passed, 28 total
# Snapshots:   0 total
# Time:        25.678 s
# 
# 📦 report is created on: C:\Users\...\coverage\html-report\report.html
# 
# --------------------------|---------|----------|---------|---------|-------------------
# File                      | % Stmts | % Branch | % Funcs | % Lines | Uncovered Line #s
# --------------------------|---------|----------|---------|---------|-------------------
# All files                 |   85.23 |    78.45 |   89.12 |   84.67 |
#  facturacion/afip         |   92.15 |    85.67 |   94.23 |   91.45 |
#  facturacion/utils        |   78.34 |    71.23 |   82.45 |   77.89 |
#  facturacion/provincia    |   75.67 |    68.90 |   79.12 |   74.56 |
# --------------------------|---------|----------|---------|---------|-------------------
```

### **🔍 Ejemplo 5: Ejecutar Tests Específicos**

```bash
# Ejecutar tests que contengan "validar" en el nombre
npm test -- --testNamePattern="validar"

# Ejecutar tests de un archivo específico
npm test -- src/modules/facturacion/__tests__/unit/AfipValidator.test.ts

# Ejecutar tests con timeout personalizado
npm test -- --testTimeout=60000

# Ejecutar tests en modo verbose
npm test -- --verbose
```

---

## 📊 COBERTURA DE CÓDIGO

### **🎯 Objetivos de Cobertura:**

```bash
# Mínimos recomendados:
- Statements: 85%
- Branches:    80%
- Functions:   90%
- Lines:       85%
```

### **📈 Ver Cobertura:**

```bash
# 1. Generar reporte
npm run test:coverage

# 2. Abrir reporte HTML
start coverage/index.html

# 3. Ver reporte en terminal
npm run test:coverage -- --coverageReporters=text
```

### **📋 Interpretación de Cobertura:**

```bash
# Verde (🟢): Código ejecutado
# Rojo (🔴): Código no ejecutado
# Amarillo (🟡): Cobertura parcial

# Ejemplo de salida:
File                      | % Stmts | % Branch | % Funcs | % Lines
--------------------------|---------|----------|---------|---------
AfipValidator.ts          |   92.15 |    85.67 |   94.23 |   91.45
IdempotencyManager.ts     |   88.34 |    82.45 |   91.12 |   87.67
TimeValidator.ts          |   85.67 |    78.90 |   89.45 |   84.23
```

---

## 🔧 TROUBLESHOOTING

### **❌ Error: "Cannot find module"**

```bash
# Problema: Módulo no encontrado
Error: Cannot find module '../../../services/DbService'

# Solución: Verificar ruta del mock
jest.mock('../../../../services/DbService', () => ({
  getDb: jest.fn(() => mockDatabase)
}));
```

### **❌ Error: "Property does not exist"**

```bash
# Problema: Propiedad no existe en interface
Error: Property 'duration' does not exist on type 'TimeValidationResult'

# Solución: Agregar propiedad al interface
export interface TimeValidationResult {
  isValid: boolean;
  drift: number;
  systemTime: Date;
  ntpTime: Date;
  duration?: number; // ✅ Agregar propiedad
  error?: string;
  warning?: string;
}
```

### **❌ Error: "Expected length"**

```bash
# Problema: Expectativa incorrecta
Expected length: 5
Received length: 6

# Solución: Ajustar expectativa
expect(result.errors).toHaveLength(6); // ✅ Corregir número
```

### **❌ Error: "Timeout"**

```bash
# Problema: Test muy lento
Timeout - Async callback was not invoked within the 5000ms timeout

# Solución: Aumentar timeout
npm test -- --testTimeout=30000
```

### **❌ Error: "Jest not found"**

```bash
# Problema: Jest no instalado
Error: Cannot find module 'jest'

# Solución: Instalar dependencias
npm install --save-dev jest @types/jest ts-jest
```

---

## 🌐 HOMOLOGACIÓN AFIP

### **📋 Requisitos para Homologación:**

1. **Clave Fiscal válida**
2. **Certificados de prueba AFIP**
3. **Acceso a WSASS (Web Service de Autoservicio)**
4. **Configuración de entorno de prueba**

### **🔧 Configuración de Homologación:**

```bash
# 1. Crear archivo de configuración
copy env.homologacion.example .env.homologacion

# 2. Editar credenciales
notepad .env.homologacion

# 3. Configurar certificados
mkdir certificados
# Agregar certificados de homologación AFIP

# 4. Ejecutar tests de homologación
npm run test:homologacion
```

### **📄 Contenido de `.env.homologacion`:**

```bash
# Credenciales AFIP de homologación
AFIP_CUIT_HOMOLOGACION=20123456789
AFIP_CERT_PATH_HOMOLOGACION=./certificados/homologacion.crt
AFIP_KEY_PATH_HOMOLOGACION=./certificados/homologacion.key

# Configuración de entorno
AFIP_ENTORNO=homologacion
NODE_ENV=homologacion

# Configuración de base de datos
DB_PATH=./test-homologacion.db
```

### **🧪 Ejecutar Tests de Homologación:**

```bash
# Ejecutar todos los tests de homologación
npm run test:homologacion

# Ejecutar test específico
npm test -- src/modules/facturacion/__tests__/homologacion/afip-homologacion.test.ts

# Ejecutar con timeout extendido
npm run test:homologacion -- --testTimeout=120000
```

### **📊 Resultados Esperados:**

```bash
# Tests de homologación exitosos
PASS src/modules/facturacion/__tests__/homologacion/afip-homologacion.test.ts

Test Suites: 1 passed, 1 total
Tests:       5 passed, 5 total
Snapshots:   0 total
Time:        45.123 s

# Casos de prueba incluidos:
✅ Emisión de factura A válida
✅ Emisión de factura B válida
✅ Validación de parámetros AFIP
✅ Control de idempotencia
✅ Validación de tiempo NTP
```

---

## 📝 COMANDOS RÁPIDOS

### **🚀 Desarrollo Diario:**

```bash
# Ejecutar tests unitarios (rápido)
npm run test:unit

# Ejecutar tests en modo watch
npm run test:watch

# Ver cobertura
npm run test:coverage
```

### **🔍 Debugging:**

```bash
# Tests con debug
npm run test:debug

# Tests con verbose
npm test -- --verbose

# Tests específicos
npm test -- --testNamePattern="validar"
```

### **🌐 Homologación:**

```bash
# Tests de homologación
npm run test:homologacion

# Tests de integración
npm run test:integration

# Todos los tests
npm test
```

---

## 📞 SOPORTE

### **🔗 Recursos Útiles:**

- **Documentación Jest**: https://jestjs.io/docs/getting-started
- **Documentación ts-jest**: https://kulshekhar.github.io/ts-jest/
- **Documentación AFIP**: https://www.afip.gob.ar/ws/documentacion/ws-factura-electronica.asp

### **📧 Contacto:**

- **Issues**: Crear issue en el repositorio
- **Documentación**: Ver `src/modules/facturacion/__tests__/README.md`
- **Configuración**: Ver `jest.config.js` y `.env.homologacion`

---

**📝 Documento generado por:** Claude Sonnet 4 - Asistente de IA  
**📅 Fecha:** $(date)  
**🎯 Versión:** 1.0  
**📊 Última actualización:** Configuración de tests completa
