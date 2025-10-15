# 🤝 Guía de Contribución

**Proyecto**: TC-MP - Sistema de Gestión de Pagos y Facturación  
**Versión**: 2.0.0  
**Fecha**: Octubre 2025

---

## 📋 Código de Conducta

Este es un proyecto **privado** de TODO-Computación. Se espera que todos los colaboradores mantengan:

### Valores

- ✅ **Respeto**: Trato profesional y cortés
- ✅ **Constructividad**: Feedback útil y orientado a soluciones
- ✅ **Profesionalismo**: Código de calidad y documentado
- ✅ **Colaboración**: Trabajo en equipo y comunicación clara

---

## 🚀 Workflow de Desarrollo

### 1. Setup Inicial

```bash
# Clonar repositorio
git clone https://github.com/ismaelsuarez/mp.git
cd mp

# Instalar Node.js 18.20.4 (usar nvm)
nvm install 18.20.4
nvm use 18.20.4

# Instalar dependencias
pnpm install

# Compilar TypeScript
pnpm build:ts

# Ejecutar aplicación
pnpm start
```

---

### 2. Crear Feature Branch

```bash
# Desde rama principal
git checkout 2.0.0

# Crear branch feature
git checkout -b feature/nombre-descriptivo

# Ejemplos de nombres:
# feature/afip-factura-c
# fix/watcher-duplicate-processing
# docs/readme-installation
# refactor/afip-service-resilience
```

**Convenciones de nombres**:
- `feature/`: Nueva funcionalidad
- `fix/`: Bug fix
- `docs/`: Documentación
- `refactor/`: Refactorización
- `test/`: Tests
- `chore/`: Tareas de mantenimiento

---

### 3. Desarrollo

#### Hacer Cambios

```bash
# Trabajar en tu branch
# Hacer cambios en el código

# Verificar tipos
pnpm typecheck

# Ejecutar tests
pnpm test

# Formatear código
pnpm format
```

#### Commits Descriptivos

**Formato**: `type(scope): message`

**Tipos**:
- `feat`: Nueva funcionalidad
- `fix`: Bug fix
- `docs`: Documentación
- `refactor`: Refactorización
- `test`: Tests
- `chore`: Tareas de mantenimiento
- `perf`: Mejoras de performance
- `style`: Cambios de estilo (no afectan lógica)

**Ejemplos**:
```bash
git commit -m "feat(afip): add support for Factura C"
git commit -m "fix(watchers): prevent duplicate processing"
git commit -m "docs(readme): update installation instructions"
git commit -m "refactor(afip-service): add circuit breaker"
git commit -m "test(facturacion): add unit tests for validators"
git commit -m "chore(deps): update electron to 30.5.1"
```

**Detalles en el body** (opcional):
```bash
git commit -m "feat(afip): add support for Factura C

- Implementar validación de Factura C
- Agregar mapping de tipos de comprobante
- Actualizar tests

Closes #123"
```

---

### 4. Push y Pull Request

```bash
# Push a origin
git push origin feature/nombre-descriptivo

# Crear Pull Request en GitHub
# Ir a https://github.com/ismaelsuarez/mp/pulls
# Click en "New Pull Request"
```

#### Template de Pull Request

```markdown
## 📝 Descripción

Breve descripción de los cambios

## 🎯 Tipo de Cambio

- [ ] Nueva funcionalidad (feature)
- [ ] Bug fix
- [ ] Documentación
- [ ] Refactorización
- [ ] Tests

## ✅ Checklist

- [ ] Código compila sin errores (`pnpm build:ts`)
- [ ] Tests pasan (`pnpm test`)
- [ ] Typecheck pasa (`pnpm typecheck`)
- [ ] Código formateado (`pnpm format`)
- [ ] Documentación actualizada
- [ ] Tests agregados (si aplica)

## 📊 Testing

Descripción de tests agregados o modificados

## 📸 Screenshots (si aplica)

Capturas de pantalla de cambios en UI
```

---

### 5. Code Review

#### Proceso

1. ✅ **Crear PR**: Push y crear Pull Request
2. ✅ **CI Checks**: Esperar que CI pase
3. ✅ **Code Review**: Al menos 1 aprobación requerida
4. ✅ **Discusión**: Responder a comentarios
5. ✅ **Merge**: Después de aprobación

#### Criterios de Aprobación

- ✅ Código compila sin errores
- ✅ Tests pasan
- ✅ Typecheck pasa
- ✅ Código formateado
- ✅ Sin linter warnings
- ✅ Documentación actualizada
- ✅ Tests suficientes (coverage ≥75%)

---

## 📏 Estándares de Código

### TypeScript

#### Strict Mode

```typescript
// ✅ Correcto: strict habilitado
{
  "compilerOptions": {
    "strict": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true
  }
}
```

#### Tipos Explícitos

```typescript
// ❌ Incorrecto: any sin justificación
function process(data: any) {
  // ...
}

// ✅ Correcto: tipo explícito
function process(data: FacturaData) {
  // ...
}

// ✅ Correcto: any justificado
function legacyApi(data: any /* TODO: type legacy API */) {
  // ...
}
```

#### Funciones Documentadas

```typescript
// ✅ Correcto: función pública documentada
/**
 * Valida un comprobante AFIP
 * @param comprobante - Datos del comprobante
 * @returns true si es válido, false otherwise
 * @throws {ValidationError} si faltan campos requeridos
 */
export function validateComprobante(
  comprobante: Comprobante
): boolean {
  // ...
}
```

---

### ESLint

#### Reglas Principales

```typescript
// ❌ Incorrecto: console.log en producción
console.log('Debug:', data);

// ✅ Correcto: usar logger
log.info('Processing data', { data });

// ❌ Incorrecto: any sin justificación
const result: any = someFunction();

// ✅ Correcto: tipo específico
const result: ProcessResult = someFunction();

// ❌ Incorrecto: variables no usadas
const unused = 123;

// ✅ Correcto: prefijo _ si intencional
const _intentionallyUnused = 123;
```

---

### Prettier

**Configuración**:
```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2
}
```

**Uso**:
```bash
# Formatear todo
pnpm format

# Verificar formateo
pnpm format:check
```

---

## 🧪 Testing

### Estructura de Tests

```typescript
// tests/unit/afip/validators.test.ts
import { describe, it, expect } from 'vitest';
import { validateComprobante } from '@core/afip/validators';

describe('validateComprobante', () => {
  it('should validate valid comprobante', () => {
    const comprobante = {
      tipo: 6,
      puntoVenta: 1,
      numero: 123,
      // ...
    };
    
    expect(validateComprobante(comprobante)).toBe(true);
  });
  
  it('should reject invalid CUIT', () => {
    const comprobante = {
      // ...
      cuit: 'invalid'
    };
    
    expect(() => validateComprobante(comprobante))
      .toThrow('CUIT inválido');
  });
});
```

### Cobertura

**Mínimo**: 75% de cobertura

**Objetivo**: ≥80% de cobertura

**Verificar**:
```bash
pnpm test:coverage
```

**Excepciones**:
- UI code (difícil de testear)
- Legacy code (en proceso de migración)
- Mocks/fixtures

---

### Tipos de Tests

#### Unit Tests

**Qué testear**:
- ✅ Lógica de negocio (`@core/*`)
- ✅ Validators, calculators, parsers
- ✅ Utilidades puras

**Ejemplo**:
```typescript
// @core/afip/cuit.ts
export function isValidCUIT(cuit: string): boolean {
  // ...
}

// tests/unit/afip/cuit.test.ts
describe('isValidCUIT', () => {
  it('should validate correct CUIT', () => {
    expect(isValidCUIT('20-12345678-9')).toBe(true);
  });
  
  it('should reject invalid CUIT', () => {
    expect(isValidCUIT('invalid')).toBe(false);
  });
});
```

#### Integration Tests

**Qué testear**:
- ✅ Servicios con dependencias (`@infra/*`)
- ✅ HTTP clients (mock APIs)
- ✅ Database operations (in-memory DB)

**Ejemplo**:
```typescript
// tests/integration/afip/AfipService.test.ts
import { describe, it, expect, beforeEach } from 'vitest';
import { AfipService } from '@infra/afip';

describe('AfipService', () => {
  let service: AfipService;
  
  beforeEach(() => {
    service = new AfipService(/* mock config */);
  });
  
  it('should create factura', async () => {
    // Mock HTTP response
    const result = await service.crearFactura(/* data */);
    expect(result.cae).toBeDefined();
  });
});
```

#### E2E Tests

**Qué testear**:
- ✅ Flujos completos (facturación end-to-end)
- ✅ Watchers (archivo → procesado)
- ✅ Contingencia (error → retry → success)

**Ejemplo**:
```typescript
// tests/e2e/facturacion.spec.ts
import { describe, it, expect } from 'vitest';

describe('Facturación E2E', () => {
  it('should process .fac file', async () => {
    // 1. Colocar archivo .fac
    // 2. Esperar procesamiento
    // 3. Verificar PDF generado
    // 4. Verificar CAE
  });
});
```

---

## 📁 Estructura de Archivos

### Organización

```
packages/core/src/
├── afip/
│   ├── helpers.ts        # Funciones auxiliares
│   ├── validators.ts     # Validaciones
│   ├── calculators.ts    # Cálculos
│   ├── index.ts          # Barrel export
│   └── __tests__/        # Tests
│       └── helpers.test.ts
│
├── licencia/
│   ├── validators.ts
│   └── index.ts
│
└── index.ts              # Main barrel export
```

### Barrel Exports

```typescript
// packages/core/src/afip/index.ts
export * from './helpers';
export * from './validators';
export * from './calculators';

// packages/core/src/index.ts
export * from './afip';
export * from './licencia';
export * from './facturacion';
```

**Uso**:
```typescript
// ✅ Correcto: import desde barrel
import { formatCUIT, validateComprobante } from '@core/afip';

// ❌ Incorrecto: import directo de archivo
import { formatCUIT } from '@core/afip/helpers';
```

---

## 🎨 UI Guidelines (si aplica)

### HTML/CSS

```html
<!-- ✅ Correcto: semántico y accesible -->
<button 
  id="submit-button" 
  class="btn btn-primary" 
  aria-label="Enviar factura"
  onclick="submitFactura()"
>
  Enviar
</button>

<!-- ❌ Incorrecto: inline styles y onclick -->
<div style="background: blue;" onclick="submit()">
  Click
</div>
```

### IPC API

```typescript
// ✅ Correcto: API tipada y segura
contextBridge.exposeInMainWorld('electronAPI', {
  sendFactura: (data: FacturaData) => 
    ipcRenderer.invoke('factura:send', data),
  
  getConfig: () => 
    ipcRenderer.invoke('config:get'),
});

// ❌ Incorrecto: exponer módulos Node.js
contextBridge.exposeInMainWorld('fs', fs);
```

---

## 📚 Documentación

### Comentarios en Código

```typescript
// ✅ Correcto: documentar funciones públicas
/**
 * Calcula el dígito verificador de un CUIT
 * @param cuit - CUIT sin dígito verificador (10 dígitos)
 * @returns Dígito verificador (0-9)
 */
export function calcularDigitoVerificador(cuit: string): number {
  // ...
}

// ✅ Correcto: comentar lógica compleja
// Algoritmo de módulo 11 para CUIT:
// 1. Multiplicar cada dígito por [5,4,3,2,7,6,5,4,3,2]
// 2. Sumar resultados
// 3. Calcular 11 - (suma % 11)
```

### README y Docs

**Actualizar**:
- ✅ README.md si cambias instalación/uso
- ✅ ARCHITECTURE.md si cambias arquitectura
- ✅ CHANGELOG.md si agregas feature/fix

---

## 🔄 Release Process

### Versioning (Semantic Versioning)

```
MAJOR.MINOR.PATCH

MAJOR: Breaking changes
MINOR: New features (backward compatible)
PATCH: Bug fixes
```

**Ejemplos**:
- `1.0.0` → `1.0.1`: Bug fix
- `1.0.1` → `1.1.0`: New feature
- `1.1.0` → `2.0.0`: Breaking change

### Crear Release

```bash
# 1. Actualizar versión en package.json
npm version patch  # o minor, o major

# 2. Actualizar CHANGELOG.md
# Agregar sección con cambios

# 3. Commit y tag
git add .
git commit -m "chore: release v1.0.1"
git tag v1.0.1

# 4. Push
git push origin 2.0.0
git push origin v1.0.1

# 5. Build y publicar
pnpm release
```

---

## ❓ Preguntas Frecuentes

### ¿Cómo ejecuto solo un test?

```bash
# Un archivo específico
pnpm test tests/unit/afip/validators.test.ts

# Un test específico (por nombre)
pnpm test -t "should validate CUIT"
```

### ¿Cómo debuggeo tests?

```bash
# Con breakpoints
pnpm test:debug

# Con UI interactiva
pnpm test:ui
```

### ¿Cómo agrego una nueva dependencia?

```bash
# Dependencia de producción
pnpm add axios

# Dependencia de desarrollo
pnpm add -D vitest

# En un package específico
cd packages/core
pnpm add dayjs
```

### ¿Cómo limpio todo y empiezo de nuevo?

```bash
# Limpiar node_modules y builds
rm -rf node_modules packages/*/node_modules dist
pnpm install
pnpm build:clean
pnpm build:ts
```

---

## 📞 Contacto

**Email**: pc@tcmza.com.ar  
**Website**: https://tcmza.com.ar

**Equipo de Desarrollo**:
- TODO-Computación
- Cursor AI Agent (asistente)

---

## 📄 Licencia

**Propietario**: TODO-Computación

Este es un proyecto privado. Todos los derechos reservados.

---

**Última actualización**: Octubre 2025  
**Estado**: ✅ Producción-ready

