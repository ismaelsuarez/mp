# Sistema de Tests Automatizados - Módulo de Facturación AFIP/ARCA

## 📋 Descripción

Este directorio contiene el sistema completo de pruebas automatizadas para el módulo de facturación AFIP/ARCA, implementado con Jest como framework principal. El sistema cubre pruebas unitarias, de integración y de homologación.

## 🏗️ Estructura del Proyecto

```
__tests__/
├── setup.ts                    # Setup principal para Jest
├── env-setup.ts               # Configuración de variables de entorno
├── setup-integration.ts       # Setup específico para tests de integración
├── setup-homologacion.ts      # Setup específico para tests de homologación
├── test-sequencer.js          # Secuenciador de tests
├── fixtures/                  # Datos de prueba
│   ├── comprobantes.ts        # Fixtures de comprobantes
│   └── mocks.ts              # Mocks de servicios externos
├── unit/                      # Tests unitarios
│   ├── AfipValidator.test.ts
│   ├── IdempotencyManager.test.ts
│   └── TimeValidator.test.ts
├── integration/               # Tests de integración
│   └── afipService.test.ts
└── homologacion/              # Tests de homologación
    └── afip-homologacion.test.ts
```

## 🚀 Comandos Disponibles

### Tests Unitarios
```bash
npm run test:unit
```

### Tests de Integración
```bash
npm run test:integration
```

### Tests de Homologación
```bash
npm run test:homologacion
```

### Todos los Tests
```bash
npm test
```

### Tests con Cobertura
```bash
npm run test:coverage
```

### Tests en Modo Watch
```bash
npm run test:watch
```

### Tests en CI/CD
```bash
npm run test:ci
```

## ⚙️ Configuración

### Variables de Entorno

#### Para Tests Unitarios/Integración
Copiar `env.test.example` a `.env.test`:
```bash
cp env.test.example .env.test
```

#### Para Tests de Homologación
Copiar `env.homologacion.example` a `.env.homologacion`:
```bash
cp env.homologacion.example .env.homologacion
```

**Importante**: Los tests de homologación requieren certificados reales de AFIP.

### Configuración de Jest

El archivo `jest.config.js` en la raíz del proyecto configura:
- Cobertura mínima del 85%
- Reportes en HTML y JSON
- Timeouts específicos por tipo de test
- Mocks automáticos de servicios externos

## 🧪 Tipos de Tests

### 1. Tests Unitarios (`unit/`)

Prueban componentes individuales de forma aislada:

- **AfipValidator**: Validación de parámetros AFIP con FEParamGet*
- **IdempotencyManager**: Control de duplicados y concurrencia
- **TimeValidator**: Validación de sincronización NTP
- **CAEValidator**: Validación de vencimientos de CAE
- **ResilienceWrapper**: Timeouts, retries y circuit breaker

### 2. Tests de Integración (`integration/`)

Prueban la interacción entre componentes:

- **afipService**: Flujo completo de `solicitarCAE()`
- Integración con ATM Mendoza (provincial)
- Validación de logs estructurados
- Persistencia en base de datos

### 3. Tests de Homologación (`homologacion/`)

Pruebas E2E con AFIP real:

- Emisión de comprobantes válidos
- Control de duplicados
- Validación de parámetros inválidos
- Validación de tiempo NTP
- Estado de servidores AFIP

## 📊 Cobertura de Tests

### Criterios de Cobertura
- **Branches**: 85%
- **Functions**: 85%
- **Lines**: 85%
- **Statements**: 85%

### Reportes
- **HTML**: `coverage/html-report/report.html`
- **JSON**: `coverage/coverage-final.json`
- **LCOV**: `coverage/lcov.info`

## 🔧 Fixtures y Mocks

### Fixtures (`fixtures/comprobantes.ts`)
- Comprobantes válidos (Factura B, C)
- Comprobantes inválidos (sin items, totales incorrectos)
- Comprobantes para duplicados
- Comprobantes con moneda extranjera
- Comprobantes para homologación

### Mocks (`fixtures/mocks.ts`)
- **afip.js**: Instancia mock de AFIP
- **TimeValidator**: Validación de tiempo mock
- **IdempotencyManager**: Control de idempotencia mock
- **Database**: Base de datos SQLite en memoria
- **NTP Client**: Cliente NTP mock

## 🚨 Casos de Prueba

### Validación FEParamGet*
- ✅ Parámetros válidos
- ❌ Tipo de comprobante inválido
- ❌ Concepto inválido
- ❌ Moneda inválida
- ❌ Punto de venta inválido
- ✅ Moneda extranjera con cotización

### Control de Idempotencia
- ✅ Emisión nueva exitosa
- ✅ Duplicado exitoso (retorna CAE existente)
- ✅ Duplicado fallido (permite reintento)
- ⚠️ Concurrencia (solo uno genera CAE)

### Validación de Tiempo NTP
- ✅ Tiempo sincronizado
- ❌ Drift excesivo (>60s)
- ⚠️ Servidor NTP caído

### Homologación AFIP
- ✅ Emisión con certificados reales
- ✅ Control de duplicados en producción
- ✅ Rechazo de parámetros inválidos
- ✅ Validación de tiempo antes de WSAA

## 📝 Logs y Debugging

### Niveles de Log
- **Tests unitarios**: `error` (solo errores)
- **Tests integración**: `warn` (errores y warnings)
- **Tests homologación**: `debug` (logs completos)

### Debugging
```bash
# Ejecutar tests con logs detallados
npm run test:debug

# Ejecutar test específico
npm test -- --testNamePattern="debería emitir comprobante válido"

# Ejecutar con Node inspector
node --inspect-brk node_modules/.bin/jest --runInBand
```

## 🔄 CI/CD

### GitHub Actions
```yaml
- name: Run Tests
  run: npm run test:ci

- name: Upload Coverage
  uses: codecov/codecov-action@v3
  with:
    file: ./coverage/lcov.info
```

### Variables de Entorno en CI
```yaml
env:
  NODE_ENV: test
  AFIP_ENTORNO: testing
  DB_PATH: :memory:
```

## 🐛 Troubleshooting

### Problemas Comunes

#### 1. Tests de Homologación Faltan
```bash
# Verificar credenciales
echo $AFIP_CUIT_HOMOLOGACION
echo $AFIP_CERT_PATH_HOMOLOGACION

# Verificar archivos
ls -la ./certificados/
```

#### 2. Timeouts en Tests
```bash
# Aumentar timeout para test específico
jest.setTimeout(120000);

# O en jest.config.js
testTimeout: 120000
```

#### 3. Mocks No Funcionan
```bash
# Limpiar cache de Jest
npm run test -- --clearCache

# Verificar imports
jest.mock('@afipsdk/afip.js', () => mockAfipInstance);
```

#### 4. Base de Datos en Memoria
```bash
# Verificar configuración
process.env.DB_PATH = ':memory:';

# Para tests de integración
const db = new Database(':memory:');
```

## 📈 Métricas y KPIs

### Métricas de Tests
- **Tiempo de ejecución**: < 5 minutos (unitarios), < 10 minutos (integración), < 15 minutos (homologación)
- **Cobertura**: > 85%
- **Tests pasando**: 100%
- **Tests de homologación**: > 90% (con certificados válidos)

### Monitoreo
- Reportes automáticos en cada PR
- Alertas en Slack/Discord por fallos
- Dashboard de métricas en GitHub

## 🔮 Próximos Pasos

### Mejoras Planificadas
- [ ] Tests de performance (carga)
- [ ] Tests de seguridad (inyección SQL, XSS)
- [ ] Tests de accesibilidad
- [ ] Tests de compatibilidad (diferentes versiones de Node.js)
- [ ] Tests de migración de base de datos

### Optimizaciones
- [ ] Paralelización de tests de integración
- [ ] Cache de fixtures
- [ ] Tests incrementales
- [ ] Reportes de performance

---

**Nota**: Este sistema de tests es parte de la Fase 6 de mejoras del módulo de facturación AFIP/ARCA. Para más información, consultar `IMPLEMENTACION_VALIDACIONES_AFIP.md`.
