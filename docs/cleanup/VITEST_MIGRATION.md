# Migración de Jest a Vitest - Plan

## Estado Actual

- **Tests con Jest**: 20 archivos en `src/modules/facturacion/__tests__/` y `sdk/afip.ts-main/tests/`
- **Tests con Vitest**: 2 archivos en `tests/` (contingency.e2e.spec.ts, pipeline.unit.spec.ts)
- **Configuración**: jest.config.js existe

## Estrategia de Migración

### Opción A: Migración Completa (Recomendada)
Migrar todos los tests de Jest a Vitest y remover Jest completamente.

**Pasos**:
1. Instalar Vitest y dependencias
2. Crear vitest.config.ts ✅
3. Migrar tests uno por uno
4. Actualizar imports y mocks
5. Remover Jest

### Opción B: Coexistencia Temporal
Mantener ambos frameworks temporalmente con adapter.

## Tests a Migrar

### src/modules/facturacion/__tests__/
- [ ] padron13.test.ts
- [ ] facturaNormal.test.ts
- [ ] mipyme.test.ts
- [ ] unit/AfipValidator.test.ts
- [ ] unit/AfipValidator.mono.test.ts
- [ ] unit/AfipValidator.fallbacks.test.ts
- [ ] unit/AfipService.createVoucher.test.ts
- [ ] unit/TimeValidator.test.ts
- [ ] unit/IdempotencyManager.test.ts
- [ ] integration/afipService.test.ts
- [ ] homologacion/afip-homologacion.test.ts

### sdk/afip.ts-main/tests/
- [ ] unit/services/register-scope-thirteen.service.test.ts
- [ ] unit/services/register-scope-ten.service.test.ts
- [ ] unit/services/register-scope-four.service.test.ts
- [ ] unit/services/register-inscription-proof.service.test.ts
- [ ] unit/services/register-scope-five.service.test.ts
- [ ] unit/services/electronic-billings.service.test.ts
- [ ] unit/services/afip.service.test.ts
- [ ] unit/auth/afip-auth.test.ts
- [ ] unit/auth/access-ticket.test.ts

## Cambios Necesarios

### Imports
```typescript
// Jest
import { describe, it, expect, jest } from '@jest/globals';

// Vitest
import { describe, it, expect, vi } from 'vitest';
```

### Mocks
```typescript
// Jest
jest.fn()
jest.spyOn()
jest.mock()

// Vitest
vi.fn()
vi.spyOn()
vi.mock()
```

## Dependencias a Instalar

```bash
pnpm add -D vitest @vitest/ui @vitest/coverage-v8
```

## Dependencias a Remover (después de migración)

```bash
pnpm remove jest ts-jest @types/jest jest-html-reporters
rm jest.config.js
```

## Scripts de package.json

```json
{
  "test": "vitest run",
  "test:watch": "vitest",
  "test:coverage": "vitest run --coverage",
  "test:ui": "vitest --ui"
}
```

## Riesgos

- Tests complejos pueden necesitar adaptaciones
- Setup files necesitan migración
- Mocks pueden comportarse diferente

## Decisión

**Proceder con Opción A** si tests son simples, de lo contrario documentar en Fase 7.

