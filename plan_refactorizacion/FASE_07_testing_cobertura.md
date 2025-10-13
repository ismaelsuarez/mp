# Fase 7: Testing y Cobertura (≥80%)

**Estado**: ⏳ PENDIENTE (después de Fase 6)

**Duración estimada**: 1-2 semanas

**Rama**: `refactor/testing-coverage`

## Objetivo

Alcanzar cobertura de tests ≥80% usando Vitest para unit/integration/E2E. Implementar React Testing Library para componentes UI (si aplica).

## Principio Fundamental

> "Tests rápidos, confiables y mantenibles. Coverage ≥80% en código crítico. Suites verdes en CI."

## Tareas Detalladas

### 1. Configurar Coverage Reporting

#### 1.1 vitest.config.ts - Coverage detallado

```typescript
import { defineConfig } from 'vitest/config';

export default defineConfig({
  test: {
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      reportsDirectory: './coverage',
      exclude: [
        'node_modules',
        'dist',
        'coverage',
        'tests',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts',
        '**/__tests__/**',
        '**/__mocks__/**',
        'scripts/**'
      ],
      include: [
        'src/**/*.ts',
        'packages/**/*.ts',
        'apps/**/*.ts'
      ],
      // Thresholds
      lines: 80,
      functions: 80,
      branches: 75,
      statements: 80
    }
  }
});
```

#### 1.2 Scripts de coverage

```json
{
  "scripts": {
    "test:coverage": "vitest run --coverage",
    "test:coverage:watch": "vitest --coverage --watch",
    "test:coverage:report": "vitest run --coverage && open coverage/index.html"
  }
}
```

### 2. Estrategia de Testing

#### 2.1 Pirámide de Testing

```
        /\
       /E2\     E2E: 10% (smoke tests críticos)
      /----\
     / Intg \   Integration: 20% (servicios, APIs, DB)
    /--------\
   /   Unit   \ Unit: 70% (lógica pura, utilidades, dominio)
  /------------\
```

#### 2.2 Priorización

**Alta prioridad (crítico)**:
1. Lógica de facturación (packages/core/facturacion)
2. Integración AFIP (packages/core/afip)
3. Integración ARCA (packages/core/arca)
4. Generación de PDFs (packages/core/pdf)
5. Procesadores de archivos

**Media prioridad**:
1. Utilidades (packages/shared)
2. HTTP resiliente (packages/infra/http)
3. Watchers (packages/infra/watchers)
4. ConfigService (packages/infra/config)

**Baja prioridad**:
1. Scripts auxiliares
2. UI components (si no son críticos)

### 3. Unit Tests

#### 3.1 Estructura de tests

```
packages/core/src/afip/
├── AfipService.ts
└── __tests__/
    ├── AfipService.test.ts
    ├── AfipService.validation.test.ts
    └── fixtures/
        └── facturaA.json
```

#### 3.2 Ejemplo: Test de lógica pura

```typescript
// packages/core/src/afip/__tests__/AfipService.test.ts

import { describe, it, expect, beforeEach } from 'vitest';
import { AfipService } from '../AfipService';
import { Factura } from '@shared/types';
import facturaAFixture from './fixtures/facturaA.json';

describe('AfipService', () => {
  let afipService: AfipService;
  
  beforeEach(() => {
    afipService = new AfipService();
  });
  
  describe('calculateTotal', () => {
    it('should calculate total correctly for Factura A', () => {
      const factura: Factura = facturaAFixture;
      const total = afipService.calculateTotal(factura);
      
      expect(total).toBe(12100); // 10000 + 2100 IVA
    });
    
    it('should handle multiple items', () => {
      const factura: Factura = {
        items: [
          { precio: 100, cantidad: 2, iva: 21 },
          { precio: 200, cantidad: 1, iva: 21 }
        ]
      };
      
      const total = afipService.calculateTotal(factura);
      expect(total).toBe(484); // (200 + 200) * 1.21
    });
  });
  
  describe('validateFactura', () => {
    it('should pass validation for valid factura', () => {
      const factura: Factura = facturaAFixture;
      expect(() => afipService.validateFactura(factura)).not.toThrow();
    });
    
    it('should throw on missing CUIT', () => {
      const factura: Factura = { ...facturaAFixture, cuit: '' };
      expect(() => afipService.validateFactura(factura)).toThrow('CUIT is required');
    });
    
    it('should throw on invalid CUIT format', () => {
      const factura: Factura = { ...facturaAFixture, cuit: '123' };
      expect(() => afipService.validateFactura(factura)).toThrow('Invalid CUIT format');
    });
  });
});
```

#### 3.3 Mocking con Vitest

```typescript
import { describe, it, expect, vi } from 'vitest';
import { AfipService } from '../AfipService';
import { afipClient } from '@infra/http';

// Mock del HTTP client
vi.mock('@infra/http', () => ({
  afipClient: {
    post: vi.fn()
  }
}));

describe('AfipService - Integration with AFIP API', () => {
  it('should call AFIP API with correct payload', async () => {
    const mockResponse = { data: { cae: '12345678' } };
    vi.mocked(afipClient.post).mockResolvedValue(mockResponse);
    
    const afipService = new AfipService();
    const cae = await afipService.obtenerCAE(factura);
    
    expect(afipClient.post).toHaveBeenCalledWith(
      '/wsfe/v1',
      expect.objectContaining({
        factura: expect.any(Object)
      })
    );
    
    expect(cae).toBe('12345678');
  });
});
```

### 4. Integration Tests

#### 4.1 Test de ConfigService con electron-store

```typescript
// packages/infra/src/config/__tests__/ConfigService.integration.test.ts

import { describe, it, expect, beforeEach, afterEach } from 'vitest';
import { ConfigService } from '../ConfigService';
import fs from 'fs/promises';
import path from 'path';

describe('ConfigService - Integration', () => {
  let configService: ConfigService;
  let tempConfigPath: string;
  
  beforeEach(async () => {
    tempConfigPath = path.join(__dirname, '__fixtures__', 'config.json');
    configService = new ConfigService({ configPath: tempConfigPath });
  });
  
  afterEach(async () => {
    await fs.unlink(tempConfigPath).catch(() => {});
  });
  
  it('should persist configuration to disk', async () => {
    configService.set('app', { companyName: 'Test Company' });
    
    // Leer archivo directamente
    const fileContent = await fs.readFile(tempConfigPath, 'utf-8');
    const config = JSON.parse(fileContent);
    
    expect(config.app.companyName).toBe('Test Company');
  });
  
  it('should load configuration from disk', async () => {
    // Escribir config manualmente
    await fs.writeFile(tempConfigPath, JSON.stringify({
      app: { companyName: 'From Disk' }
    }));
    
    // Crear nueva instancia (debería cargar desde disco)
    const newConfigService = new ConfigService({ configPath: tempConfigPath });
    
    expect(newConfigService.get('app').companyName).toBe('From Disk');
  });
});
```

#### 4.2 Test de HTTP con server mock

```typescript
// packages/infra/src/http/__tests__/ResilientHttp.integration.test.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { ResilientHttp } from '../ResilientHttp';
import { setupServer } from 'msw/node';
import { rest } from 'msw';

const server = setupServer(
  rest.get('http://localhost:3000/api/test', (req, res, ctx) => {
    return res(ctx.json({ success: true }));
  }),
  
  rest.get('http://localhost:3000/api/flaky', (req, res, ctx) => {
    const attempt = parseInt(req.headers.get('x-attempt') || '1');
    if (attempt < 3) {
      return res(ctx.status(500));
    }
    return res(ctx.json({ success: true }));
  })
);

beforeAll(() => server.listen());
afterAll(() => server.close());

describe('ResilientHttp - Integration', () => {
  it('should successfully make GET request', async () => {
    const http = new ResilientHttp({ baseURL: 'http://localhost:3000' });
    const response = await http.get('/api/test');
    
    expect(response.data).toEqual({ success: true });
  });
  
  it('should retry on failure and succeed', async () => {
    const http = new ResilientHttp({
      baseURL: 'http://localhost:3000',
      retries: 3
    });
    
    // Este endpoint falla las primeras 2 veces
    const response = await http.get('/api/flaky');
    
    expect(response.data).toEqual({ success: true });
  });
});
```

### 5. E2E Tests

#### 5.1 Test de flujo completo de facturación

```typescript
// tests/e2e/facturacion.e2e.spec.ts

import { describe, it, expect, beforeAll, afterAll } from 'vitest';
import { app } from 'electron';
import fs from 'fs/promises';
import path from 'path';

describe('E2E: Facturación Flow', () => {
  let testWatchFolder: string;
  let testDoneFolder: string;
  
  beforeAll(async () => {
    testWatchFolder = path.join(__dirname, '__fixtures__', 'watch');
    testDoneFolder = path.join(__dirname, '__fixtures__', 'done');
    
    await fs.mkdir(testWatchFolder, { recursive: true });
    await fs.mkdir(testDoneFolder, { recursive: true });
    
    // Iniciar app con config de test
    // ...
  });
  
  afterAll(async () => {
    await fs.rm(testWatchFolder, { recursive: true, force: true });
    await fs.rm(testDoneFolder, { recursive: true, force: true });
  });
  
  it('should process .fac file and generate PDF', async () => {
    // 1. Copiar archivo .fac a carpeta watch
    const facFile = path.join(__dirname, '__fixtures__', 'FA-0001.fac');
    const targetFile = path.join(testWatchFolder, 'FA-0001.fac');
    await fs.copyFile(facFile, targetFile);
    
    // 2. Esperar procesamiento (con timeout)
    await new Promise((resolve) => setTimeout(resolve, 5000));
    
    // 3. Verificar que archivo se movió a .done
    const doneFile = path.join(testDoneFolder, 'FA-0001.fac');
    const exists = await fs.access(doneFile).then(() => true).catch(() => false);
    expect(exists).toBe(true);
    
    // 4. Verificar que PDF fue generado
    const pdfFile = path.join(testDoneFolder, 'FA-0001.pdf');
    const pdfExists = await fs.access(pdfFile).then(() => true).catch(() => false);
    expect(pdfExists).toBe(true);
  });
});
```

### 6. React Testing Library (si aplica)

```bash
pnpm add -D @testing-library/react @testing-library/user-event @testing-library/jest-dom
```

```typescript
// apps/electron/renderer/__tests__/SettingsForm.test.tsx

import { describe, it, expect, vi } from 'vitest';
import { render, screen, fireEvent, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { SettingsForm } from '../SettingsForm';

describe('SettingsForm', () => {
  it('should render form fields', () => {
    render(<SettingsForm />);
    
    expect(screen.getByLabelText('Company Name')).toBeInTheDocument();
    expect(screen.getByLabelText('CUIT')).toBeInTheDocument();
  });
  
  it('should submit form with valid data', async () => {
    const onSubmit = vi.fn();
    render(<SettingsForm onSubmit={onSubmit} />);
    
    const user = userEvent.setup();
    
    await user.type(screen.getByLabelText('Company Name'), 'Test Company');
    await user.type(screen.getByLabelText('CUIT'), '20-12345678-9');
    await user.click(screen.getByRole('button', { name: /save/i }));
    
    await waitFor(() => {
      expect(onSubmit).toHaveBeenCalledWith({
        companyName: 'Test Company',
        cuit: '20-12345678-9'
      });
    });
  });
  
  it('should show validation error on invalid CUIT', async () => {
    render(<SettingsForm />);
    
    const user = userEvent.setup();
    
    await user.type(screen.getByLabelText('CUIT'), '123');
    await user.click(screen.getByRole('button', { name: /save/i }));
    
    expect(await screen.findByText(/invalid cuit format/i)).toBeInTheDocument();
  });
});
```

### 7. Coverage Goals por Módulo

| Módulo | Target Coverage | Prioridad |
|--------|----------------|-----------|
| packages/core/facturacion | ≥90% | Alta |
| packages/core/afip | ≥85% | Alta |
| packages/core/pdf | ≥80% | Alta |
| packages/shared | ≥85% | Media |
| packages/infra/http | ≥80% | Media |
| packages/infra/watchers | ≥75% | Media |
| packages/infra/config | ≥80% | Media |
| src/processors | ≥80% | Alta |

### 8. CI - Enforce Coverage

```yaml
# .github/workflows/ci.yml

- name: Run tests with coverage
  run: pnpm test:coverage

- name: Check coverage thresholds
  run: |
    # Vitest falla automáticamente si no alcanza thresholds
    # Configurados en vitest.config.ts

- name: Upload coverage to Codecov (opcional)
  uses: codecov/codecov-action@v3
  with:
    files: ./coverage/lcov.info
    fail_ci_if_error: true
```

### 9. Test Documentation

```markdown
# docs/testing/README.md

## Testing Strategy

### Unit Tests
- Lógica pura, sin dependencias externas
- Fast, isolated, deterministic
- Cobertura: 70% del total

### Integration Tests
- Servicios con dependencias reales o mocks
- DB, filesystem, HTTP mocks
- Cobertura: 20% del total

### E2E Tests
- Flujos críticos completos
- Electron app con config de test
- Cobertura: 10% del total

## Running Tests

```bash
# All tests
pnpm test

# Watch mode
pnpm test:watch

# Coverage
pnpm test:coverage

# E2E only
pnpm test:e2e

# Specific file
pnpm vitest run path/to/file.test.ts
```

## Writing Tests

### Best Practices

1. **Arrange-Act-Assert**: Estructura clara
2. **One assertion per test** (when possible)
3. **Descriptive test names**: `it('should X when Y')`
4. **Use fixtures**: Datos de test reutilizables
5. **Mock external dependencies**: No llamadas reales a APIs
6. **Test edge cases**: Null, undefined, empty, errors

### Naming Convention

- Test files: `*.test.ts` (unit), `*.integration.test.ts` (integration), `*.e2e.spec.ts` (E2E)
- Test suites: `describe('ModuleName')`
- Test cases: `it('should do X when Y')`
```

## Checklist de Aceptación

- [ ] Coverage ≥80% global
- [ ] Coverage ≥90% en módulos críticos (facturacion, afip)
- [ ] Unit tests para lógica de dominio
- [ ] Integration tests para servicios
- [ ] E2E tests para flujos críticos
- [ ] React Testing Library para UI (si aplica)
- [ ] Todos los tests pasan en CI
- [ ] Coverage thresholds enforced en CI
- [ ] Documentación de testing completa
- [ ] **Funcionalidad sin cambios**

## Métricas de Éxito

- **Coverage**: ≥80%
- **Test execution time**: <30s para unit tests
- **Flaky tests**: 0
- **CI pass rate**: ≥95%

## Próxima Fase

**[Fase 8: Build & Config Profesional](./FASE_08_build_config.md)** - ESLint, Prettier, builds sin warnings.

---

**Última actualización**: Octubre 2025

