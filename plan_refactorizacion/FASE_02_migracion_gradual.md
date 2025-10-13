# Fase 2: Migración Gradual a @core/@infra/@shared

**Estado**: ⏳ PENDIENTE (después de Fase 1)

**Duración estimada**: 1-2 semanas

**Rama**: `refactor/migrate-to-packages`

## Objetivo

Migrar lógica de negocio a packages/ (core, infra, shared) de forma gradual, un dominio por vez, manteniendo compatibilidad con código existente mediante shims y barrels. **Sin romper imports ni funcionalidad**.

## Principio Fundamental

> "Migración incremental con shims. Los imports viejos deben seguir funcionando mientras se actualiza código nuevo."

## Estrategia de Migración

### Enfoque: Por Dominio

1. **Primero**: Tipos y utilidades (bajo riesgo)
2. **Segundo**: Lógica de dominio pura (sin dependencias externas)
3. **Tercero**: Adaptadores e integraciones

### Orden Recomendado

1. `@shared` - Tipos, constantes, utilidades puras
2. `@core` - MP, AFIP, ARCA, lógica de negocio, PDFs
3. `@infra` - HTTP básico, file system (migración completa en Fase 4-5)

## Tareas Detalladas

### 1. Migrar a @shared

#### 1.1 Identificar candidatos

Buscar en `src/`:
- Tipos TypeScript (`interface`, `type`, `enum`)
- Constantes
- Utilidades puras (sin side effects)
- Helpers de formato/validación

**Ejemplo de candidatos**:
```typescript
// src/types/factura.ts → packages/shared/src/types/factura.ts
// src/utils/format.ts → packages/shared/src/utils/format.ts
// src/constants/afip.ts → packages/shared/src/constants/afip.ts
```

#### 1.2 Crear estructura en @shared

```
packages/shared/src/
├── types/
│   ├── index.ts
│   ├── factura.ts
│   ├── payment.ts
│   └── afip.ts
├── utils/
│   ├── index.ts
│   ├── format.ts
│   ├── validators.ts
│   └── parsers.ts
├── constants/
│   ├── index.ts
│   ├── afip.ts
│   └── codes.ts
└── index.ts  # Barrel export
```

#### 1.3 Mover archivos

Para cada archivo:

1. **Copiar** (no mover) a nueva ubicación en packages/shared/
2. Actualizar imports dentro del archivo movido
3. Exportar desde barrel (packages/shared/src/index.ts)
4. Crear shim en ubicación original

**Ejemplo**:

```typescript
// packages/shared/src/types/factura.ts
export interface Factura {
  numero: string;
  // ...
}

// packages/shared/src/types/index.ts
export * from './factura';
export * from './payment';
export * from './afip';

// packages/shared/src/index.ts
export * from './types';
export * from './utils';
export * from './constants';

// src/types/factura.ts (SHIM - mantener temporalmente)
// @deprecated Use @shared/types/factura instead
// TODO(phase-2-cleanup): Remove after all imports updated
export * from '@shared/types/factura';
```

#### 1.4 Actualizar imports progresivamente

**Opción A: Big bang** (si pocos imports)
Buscar y reemplazar todos los imports a la vez.

**Opción B: Gradual** (recomendado)
- Nuevos archivos usan `@shared/*`
- Archivos existentes mantienen imports viejos (funcionan via shim)
- Actualizar gradualmente en PRs subsiguientes

```typescript
// Viejo (sigue funcionando via shim)
import { Factura } from '../types/factura';

// Nuevo (recomendado para código nuevo/actualizado)
import { Factura } from '@shared/types/factura';
```

### 2. Migrar a @core

#### 2.1 Identificar lógica de dominio

Buscar:
- Reglas de negocio
- Entidades de dominio
- Servicios puros (sin dependencias de infra)
- Procesadores de facturas
- Generadores de PDFs
- Lógica AFIP/ARCA/MP (solo reglas, no HTTP)

**Ejemplo de candidatos**:
```
src/modules/facturacion/ → packages/core/src/facturacion/
src/services/afipService.ts → packages/core/src/afip/ (solo lógica)
src/pdfRenderer.ts → packages/core/src/pdf/
```

#### 2.2 Crear estructura en @core

```
packages/core/src/
├── facturacion/
│   ├── index.ts
│   ├── entities/
│   │   ├── Factura.ts
│   │   └── Recibo.ts
│   ├── services/
│   │   ├── FacturaService.ts
│   │   └── ReciboService.ts
│   └── processors/
│       ├── FacturaProcessor.ts
│       └── RemitoProcessor.ts
├── afip/
│   ├── index.ts
│   ├── AfipService.ts
│   ├── validators/
│   └── rules/
├── arca/
│   ├── index.ts
│   └── ArcaService.ts
├── mercadopago/
│   ├── index.ts
│   ├── PaymentProcessor.ts
│   └── ReportGenerator.ts
├── pdf/
│   ├── index.ts
│   ├── PdfRenderer.ts
│   └── templates/
└── index.ts
```

#### 2.3 Migrar módulo por módulo

**Proceso para cada módulo**:

1. Crear estructura en @core
2. Copiar lógica de dominio (extraer de servicios si necesario)
3. Separar lógica pura de infraestructura:
   - **Lógica pura** → @core
   - **HTTP/DB/FS** → mantener en src/ (migrar en Fase 4-5)
4. Actualizar imports a usar @shared
5. Exportar desde barrel
6. Crear shim en ubicación original
7. Tests: copiar y adaptar

**Ejemplo - AfipService**:

```typescript
// packages/core/src/afip/AfipService.ts
import { Factura, AfipConfig } from '@shared/types';

export class AfipService {
  // Solo lógica de negocio, sin HTTP directo
  calculateCAE(factura: Factura): string {
    // ...
  }
  
  validateFactura(factura: Factura): ValidationResult {
    // ...
  }
  
  // NOTA: HTTP se queda en src/ por ahora (Fase 4)
}

// packages/core/src/afip/index.ts
export * from './AfipService';
export * from './validators';

// packages/core/src/index.ts
export * from './afip';
export * from './facturacion';
export * from './pdf';

// src/services/afipService.ts (SHIM)
// @deprecated Use @core/afip instead
export * from '@core/afip/AfipService';
```

#### 2.4 Migrar tests

Copiar tests a nueva ubicación:

```
packages/core/src/afip/__tests__/
├── AfipService.test.ts
└── validators.test.ts
```

Actualizar imports en tests:
```typescript
// Antes
import { AfipService } from '../afipService';

// Después
import { AfipService } from '@core/afip';
```

### 3. Preparar @infra (estructura, migración en Fase 4-5)

Por ahora solo crear estructura y stubs:

```
packages/infra/src/
├── http/
│   ├── index.ts
│   └── README.md  # "TODO: Migrate in Phase 4"
├── watchers/
│   ├── index.ts
│   └── README.md  # "TODO: Migrate in Phase 5"
├── logger/
│   ├── index.ts
│   └── README.md  # "TODO: Migrate in Phase 4"
├── config/
│   ├── index.ts
│   └── README.md  # "TODO: Migrate in Phase 3"
└── index.ts
```

```typescript
// packages/infra/src/http/index.ts
/**
 * HTTP client with resilience (timeout, retries, circuit-breaker)
 * TODO(phase-4): Implement resilient HTTP layer
 */
export const HTTP_PLACEHOLDER = 'To be implemented in Phase 4';
```

### 4. Actualizar package.json de packages

#### 4.1 packages/shared/package.json

```json
{
  "name": "@tc-mp/shared",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {},
  "devDependencies": {
    "typescript": "^5.9.2",
    "vitest": "workspace:*"
  }
}
```

#### 4.2 packages/core/package.json

```json
{
  "name": "@tc-mp/core",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tc-mp/shared": "workspace:*"
  },
  "devDependencies": {
    "typescript": "^5.9.2",
    "vitest": "workspace:*"
  }
}
```

#### 4.3 packages/infra/package.json

```json
{
  "name": "@tc-mp/infra",
  "version": "1.0.0",
  "main": "src/index.ts",
  "types": "src/index.ts",
  "scripts": {
    "test": "vitest run",
    "typecheck": "tsc --noEmit"
  },
  "dependencies": {
    "@tc-mp/shared": "workspace:*",
    "axios": "^1.10.0",
    "chokidar": "^4.0.3",
    "winston": "^3.17.0"
  },
  "devDependencies": {
    "typescript": "^5.9.2",
    "vitest": "workspace:*"
  }
}
```

### 5. Validación y Testing

#### 5.1 Verificar builds

```bash
# Build individual packages
pnpm --filter @tc-mp/shared build
pnpm --filter @tc-mp/core build
pnpm --filter @tc-mp/infra build

# Build global
pnpm build:ts
```

#### 5.2 Ejecutar tests

```bash
# Tests de packages
pnpm --filter @tc-mp/shared test
pnpm --filter @tc-mp/core test

# Tests globales
pnpm test
```

#### 5.3 Smoke tests

Ejecutar los mismos smoke tests de Fase 1:
- ✅ Electron arranca
- ✅ PDFs se generan
- ✅ Watchers funcionan
- ✅ AFIP funciona

### 6. Limpieza progresiva de shims

**NO hacer en Fase 2** - mantener shims hasta Fase 8.

Documentar en `docs/cleanup/SHIMS_TO_REMOVE.md`:

```markdown
# Shims to Remove in Phase 8

## src/types/factura.ts
- Created: Phase 2
- Remove after: All imports updated
- Search: `import.*from.*['"](\.\.\/)*types/factura`

(lista completa...)
```

## Checklist de Aceptación

- [ ] @shared implementado con tipos, utils, constants
- [ ] @core implementado con lógica de dominio (facturacion, afip, pdf)
- [ ] @infra estructura creada (implementación en Fase 4-5)
- [ ] Shims funcionando correctamente
- [ ] Path aliases resolviendo correctamente
- [ ] package.json de cada package configurado
- [ ] Tests migrados y pasando
- [ ] Build compila sin errores
- [ ] Smoke tests OK
- [ ] **Funcionalidad sin cambios**
- [ ] Documentación de shims para limpieza futura

## Métricas de Éxito

- **Código migrado a packages/**: >60%
- **Tests pasando**: 100%
- **Build time**: Sin degradación
- **TS errors**: 0 nuevos

## Riesgos y Mitigaciones

| Riesgo | Mitigación |
|--------|-----------|
| Imports rotos | Shims mantienen compatibilidad |
| Circular dependencies | Diseño cuidadoso de dependencias entre packages |
| Tests fallan | Copiar y adaptar tests gradualmente |
| Path aliases no resuelven | Verificar tsconfig y build tools |

## Próxima Fase

**[Fase 3: Config UI + Seguridad](./FASE_03_config_ui_seguridad.md)** - Reemplazar .env por Settings UI + keytar.

---

**Última actualización**: Octubre 2025

