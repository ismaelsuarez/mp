# Fase 1: Red de Seguridad + Estructura Base + Testing Unificado

**Estado**: ✅ EN EJECUCIÓN

**Duración estimada**: 2-3 días

**Rama**: `refactor/structure-init-vitest-cleanup`

## Objetivo

Crear el esqueleto del monorepo con estructura apps/ y packages/, habilitar TypeScript strict, migrar testing a Vitest, y generar reportes de limpieza. **SIN cambios funcionales** - toda la lógica existente debe seguir funcionando igual.

## Principio Fundamental

> "No mover lógica crítica en Fase 1; solo esqueleto + aliases + shims si hace falta."

## Tareas Detalladas

### 1. Crear Rama y Configuración Base

#### 1.1 Crear rama
```bash
git checkout -b refactor/structure-init-vitest-cleanup
```

#### 1.2 Crear .nvmrc
```
v18.20.4
```

#### 1.3 Actualizar package.json
```json
{
  "packageManager": "pnpm@^9.0.0"
}
```

#### 1.4 Remover package-lock.json
```bash
rm package-lock.json
```

**Justificación**: Estandarizar en PNPM para monorepo.

### 2. Crear Estructura Monorepo

#### 2.1 Directorios a crear

```bash
mkdir -p apps/electron/renderer
mkdir -p apps/server/src
mkdir -p apps/web
mkdir -p packages/core/src
mkdir -p packages/infra/src
mkdir -p packages/shared/src
mkdir -p packages/config
```

#### 2.2 Archivos esqueleto

**apps/electron/main.ts** (shim):
```typescript
// Shim para mantener compatibilidad durante migración
// TODO(phase-2): Migrar lógica a arquitectura monorepo
export * from '../../src/main';
```

**apps/electron/preload.ts** (shim):
```typescript
// Shim para mantener compatibilidad durante migración
// TODO(phase-2): Migrar lógica a arquitectura monorepo
export * from '../../src/preload';
```

**packages/core/src/index.ts**:
```typescript
/**
 * @package core
 * @description Dominio puro: reglas de negocio, entidades, lógica AFIP/ARCA/MP
 * 
 * Este paquete NO debe tener dependencias de infraestructura.
 * Solo lógica de negocio pura.
 */

// TODO(phase-2): Migrar lógica de dominio aquí
export const CORE_VERSION = '1.0.0-phase1';
```

**packages/infra/src/index.ts**:
```typescript
/**
 * @package infra
 * @description Infraestructura: HTTP, watchers, logger, config loader
 * 
 * Este paquete contiene adaptadores y utilidades de plataforma.
 */

// TODO(phase-4): Migrar HTTP resiliente aquí
// TODO(phase-5): Migrar watchers robustos aquí
export const INFRA_VERSION = '1.0.0-phase1';
```

**packages/shared/src/index.ts**:
```typescript
/**
 * @package shared
 * @description Tipos, utilidades y constantes compartidas
 * 
 * Este paquete debe ser agnóstico de dominio e infraestructura.
 */

// TODO(phase-2): Migrar tipos y utils comunes aquí
export const SHARED_VERSION = '1.0.0-phase1';
```

**apps/server/src/index.ts**:
```typescript
/**
 * @app server
 * @description Backend HTTP (API REST) - Opcional
 * 
 * NOTA: Esqueleto creado en Fase 1. No acoplado a flujos críticos.
 * TODO(phase-3): Implementar si se requiere API REST
 */

console.log('Server skeleton - not yet implemented');
```

**apps/web/package.json**:
```json
{
  "name": "@tc-mp/web",
  "version": "1.0.0",
  "private": true,
  "description": "Next.js web frontend - Skeleton",
  "scripts": {
    "dev": "echo 'Web skeleton - not yet implemented'",
    "build": "echo 'Web skeleton - not yet implemented'"
  }
}
```

### 3. Configurar Path Aliases

#### 3.1 Crear packages/config/tsconfig.base.json

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "module": "commonjs",
    "lib": ["ES2020"],
    "moduleResolution": "node",
    "esModuleInterop": true,
    "allowSyntheticDefaultImports": true,
    "strict": true,
    "skipLibCheck": true,
    "resolveJsonModule": true,
    "declaration": true,
    "declarationMap": true,
    "sourceMap": true,
    "noUnusedLocals": true,
    "noUnusedParameters": true,
    "noImplicitReturns": true,
    "noFallthroughCasesInSwitch": true,
    "forceConsistentCasingInFileNames": true,
    "baseUrl": ".",
    "paths": {
      "@core/*": ["../../packages/core/src/*"],
      "@infra/*": ["../../packages/infra/src/*"],
      "@shared/*": ["../../packages/shared/src/*"],
      "@electron/*": ["../../apps/electron/*"]
    }
  },
  "exclude": ["node_modules", "dist", "coverage"]
}
```

#### 3.2 Actualizar tsconfig.json raíz

```json
{
  "extends": "./packages/config/tsconfig.base.json",
  "compilerOptions": {
    "outDir": "./dist",
    "rootDir": ".",
    "baseUrl": ".",
    "paths": {
      "@core/*": ["packages/core/src/*"],
      "@infra/*": ["packages/infra/src/*"],
      "@shared/*": ["packages/shared/src/*"],
      "@electron/*": ["apps/electron/*"]
    }
  },
  "include": ["src/**/*", "apps/**/*", "packages/**/*", "tests/**/*"],
  "exclude": ["node_modules", "dist", "coverage", "build"]
}
```

### 4. Habilitar TypeScript Strict

#### 4.1 Proceso

1. Verificar que `"strict": true` esté en tsconfig.json
2. Ejecutar `pnpm build:ts` y capturar errores
3. Analizar errores:
   - **Simples** (null checks, types explícitos): Corregir
   - **Complejos** (refactors profundos): Marcar con `@ts-expect-error`

#### 4.2 Formato de excepciones

```typescript
// @ts-expect-error TODO(phase-1): strict migration - any type from external lib, needs wrapper
const result: any = externalLibFunction();
```

#### 4.3 Documentar excepciones

Crear `docs/cleanup/TS_STRICT_EXCEPTIONS.md`:

```markdown
# TypeScript Strict - Excepciones Fase 1

## Total de excepciones: X archivos

### Archivo: src/path/to/file.ts
- **Línea X**: `@ts-expect-error` - Descripción del problema
- **Razón**: Refactor profundo requerido, riesgo de romper funcionalidad
- **Plan**: Resolver en Fase 2/7

(Repetir para cada archivo)

## Prioridad para resolución

1. High: Archivos críticos (main.ts, afip, watchers)
2. Medium: Servicios y utilidades
3. Low: Scripts y helpers
```

### 5. Migrar/Unificar Testing a Vitest

#### 5.1 Instalar dependencias

```bash
pnpm add -D vitest @vitest/ui @vitest/coverage-v8
```

#### 5.2 Crear vitest.config.ts unificado

```typescript
import { defineConfig } from 'vitest/config';
import path from 'path';

export default defineConfig({
  test: {
    environment: 'node',
    include: [
      'src/**/*.test.ts',
      'src/**/*.spec.ts',
      'tests/**/*.test.ts',
      'tests/**/*.spec.ts',
      'sdk/**/*.test.ts'
    ],
    exclude: ['node_modules', 'dist', 'coverage', 'build'],
    globals: true,
    threads: false,
    hookTimeout: 30000,
    testTimeout: 60000,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html', 'lcov'],
      exclude: [
        'node_modules',
        'dist',
        'coverage',
        'tests',
        '**/*.d.ts',
        '**/*.config.*',
        '**/mockData.ts'
      ]
    },
    setupFiles: ['./src/modules/facturacion/__tests__/setup.ts']
  },
  resolve: {
    alias: {
      '@core': path.resolve(__dirname, './packages/core/src'),
      '@infra': path.resolve(__dirname, './packages/infra/src'),
      '@shared': path.resolve(__dirname, './packages/shared/src'),
      '@electron': path.resolve(__dirname, './apps/electron'),
      'src': path.resolve(__dirname, './src')
    }
  }
});
```

#### 5.3 Estrategia de migración de tests

**Opción A: Migración completa (recomendada si tests son simples)**

Para cada archivo `*.test.ts`:

1. Cambiar imports:
```typescript
// Antes (Jest)
import { describe, it, expect, jest } from '@jest/globals';

// Después (Vitest)
import { describe, it, expect, vi } from 'vitest';
```

2. Reemplazar mocks:
```typescript
// Antes
jest.fn()
jest.spyOn()
jest.mock()

// Después
vi.fn()
vi.spyOn()
vi.mock()
```

3. Ejecutar y verificar:
```bash
pnpm vitest run
```

**Opción B: Adapter temporal (si tests complejos o riesgosos)**

Si la migración completa es muy riesgosa, documentar en Fase 7 y usar adapter de compatibilidad.

#### 5.4 Actualizar package.json scripts

```json
{
  "scripts": {
    "test": "vitest run",
    "test:watch": "vitest",
    "test:coverage": "vitest run --coverage",
    "test:ui": "vitest --ui",
    "test:e2e": "vitest run --config vitest.config.ts --dir tests"
  }
}
```

#### 5.5 Remover Jest (después de migración exitosa)

```bash
pnpm remove jest ts-jest @types/jest jest-html-reporters
rm jest.config.js
```

### 6. Crear CI Mínima

#### 6.1 Crear .github/workflows/ci.yml

```yaml
name: CI

on:
  push:
    branches: [2.0.0, refactor/**]
  pull_request:
    branches: [2.0.0]

jobs:
  test:
    runs-on: windows-latest
    
    steps:
      - name: Checkout code
        uses: actions/checkout@v4
      
      - name: Setup Node.js
        uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      
      - name: Setup PNPM
        uses: pnpm/action-setup@v2
        with:
          version: 9
      
      - name: Install dependencies
        run: pnpm install --frozen-lockfile
      
      - name: Type check
        run: pnpm typecheck
      
      - name: Run tests
        run: pnpm test
      
      - name: Build
        run: pnpm build:ts
      
      - name: Upload coverage
        if: always()
        uses: actions/upload-artifact@v3
        with:
          name: coverage
          path: coverage/
```

### 7. Generar Reportes de Limpieza

#### 7.1 Instalar herramientas

```bash
pnpm add -D depcheck ts-prune
```

#### 7.2 Ejecutar análisis

```bash
# Dependencias no usadas
pnpm exec depcheck --json > docs/cleanup/depcheck.json

# Exports/imports sin usar
pnpm exec ts-prune > docs/cleanup/ts-prune.txt
```

#### 7.3 Crear docs/cleanup/REPORT.md

```markdown
# Reporte de Limpieza - Fase 1

Generado: [FECHA]

## Resumen Ejecutivo

- **Dependencias sin usar detectadas**: X
- **Exports sin usar detectados**: Y
- **Código muerto potencial**: Z archivos

## 1. Dependencias No Usadas

### Dependencias de producción
[Lista de depcheck.json - dependencies]

### Dependencias de desarrollo
[Lista de depcheck.json - devDependencies]

### Recomendación
- Revisar manualmente antes de remover
- Algunas pueden ser usadas en runtime (Electron)
- Documentar decisión de mantener/remover

## 2. Exports/Imports Sin Usar

### Archivos con exports no utilizados
[Lista de ts-prune.txt]

### Análisis
- Algunos exports pueden ser API pública
- Otros son código muerto real

## 3. Duplicaciones Obvias

[Análisis manual de código duplicado]

## 4. Oportunidades de Mejora

### Para Fase 2
- Consolidar utilidades duplicadas en @shared
- Extraer lógica de dominio a @core

### Para Fase 4-5
- Unificar manejo de HTTP
- Consolidar watchers

### Para Fase 7
- Aumentar coverage de módulos críticos

## 5. Recomendaciones

1. NO remover nada en Fase 1 (solo documentar)
2. Priorizar limpieza en Fase 2
3. Validar con smoke tests antes de remover
```

### 8. Crear Smoke Tests

#### 8.1 docs/smokes/SMOKE_ELECTRON.md

```markdown
# Smoke Test: Electron

## Objetivo
Verificar que la aplicación Electron arranca y funciona correctamente después de Fase 1.

## Pre-requisitos
- Build compilado: `pnpm build:ts`
- Dependencias instaladas: `pnpm install`

## Pasos

### 1. Arranque de aplicación
```bash
pnpm start
```

**Esperado**: 
- [ ] Aplicación arranca sin errores
- [ ] Splash screen se muestra
- [ ] Ventana principal se abre
- [ ] No hay errores en consola

### 2. Navegación básica
- [ ] Cambiar entre modos (Admin, Caja, Imagen)
- [ ] Abrir configuración
- [ ] Ver licencia

### 3. Cierre
- [ ] Cerrar aplicación correctamente
- [ ] Sin procesos zombies

## Resultado
- [ ] ✅ PASS
- [ ] ❌ FAIL - Descripción del error:

## Notas
```

#### 8.2 docs/smokes/SMOKE_PDF.md

```markdown
# Smoke Test: Generación de PDFs

## Objetivo
Verificar que la generación de PDFs funciona igual que antes.

## Pre-requisitos
- Build compilado
- Archivo .fac de prueba en tmp/controlar/

## Pasos

### 1. Generar PDF desde .fac
```bash
pnpm pdf:example
```

**Esperado**:
- [ ] PDF generado en test-output/
- [ ] Contenido correcto (QR, datos, formato)
- [ ] Sin errores en consola

### 2. Calibración
```bash
pnpm pdf:calibrate
```

**Esperado**:
- [ ] calibration.pdf generado
- [ ] Formato correcto

## Resultado
- [ ] ✅ PASS
- [ ] ❌ FAIL - Descripción:

## Notas
```

#### 8.3 docs/smokes/SMOKE_WATCHERS.md

```markdown
# Smoke Test: Watchers

## Objetivo
Verificar que los watchers de archivos funcionan correctamente.

## Pre-requisitos
- Aplicación corriendo
- Configuración válida

## Pasos

### 1. Watcher de facturas
1. Iniciar aplicación en modo Caja
2. Copiar archivo .fac a carpeta monitoreada
3. Esperar procesamiento

**Esperado**:
- [ ] Archivo detectado
- [ ] Procesamiento completado
- [ ] PDF generado
- [ ] Archivo movido a .done/
- [ ] Sin reprocesos

### 2. Cambio de configuración
1. Cambiar ruta de watcher en config
2. Reiniciar watcher

**Esperado**:
- [ ] Watcher se reinicia correctamente
- [ ] Nueva ruta monitoreada
- [ ] Sin errores

## Resultado
- [ ] ✅ PASS
- [ ] ❌ FAIL - Descripción:

## Notas
```

#### 8.4 docs/smokes/SMOKE_AFIP.md

```markdown
# Smoke Test: Integración AFIP

## Objetivo
Verificar que la integración con AFIP funciona igual.

## Pre-requisitos
- Credenciales de homologación configuradas
- Certificados válidos

## Pasos

### 1. Autenticación
```bash
pnpm diagnostico:afip
```

**Esperado**:
- [ ] Login exitoso
- [ ] Ticket de acceso obtenido
- [ ] Sin errores

### 2. Consulta de padrón (si aplica)
- [ ] Consulta exitosa
- [ ] Datos correctos

### 3. Facturación (ambiente homo)
- [ ] Generar factura de prueba
- [ ] CAE obtenido
- [ ] PDF generado correctamente

## Resultado
- [ ] ✅ PASS
- [ ] ❌ FAIL - Descripción:

## Notas
```

### 9. Actualizar pnpm-workspace.yaml

```yaml
packages:
  - 'apps/*'
  - 'packages/*'
  - 'sdk/*'
```

### 10. Crear .gitignore updates (si necesario)

Asegurar que están ignorados:
```
# Build outputs
dist/
dist-scripts/

# Monorepo
.pnpm-store/

# Testing
coverage/
.vitest/
```

## Checklist de Aceptación

- [ ] Build compila sin errores: `pnpm build:ts`
- [ ] Tests pasan: `pnpm test`
- [ ] Typecheck OK: `pnpm typecheck`
- [ ] Estructura monorepo creada (apps/, packages/)
- [ ] Path aliases funcionando
- [ ] TS strict habilitado (excepciones documentadas si existen)
- [ ] Testing unificado en Vitest
- [ ] CI ejecutándose correctamente
- [ ] Reportes de limpieza generados
- [ ] Smoke tests manuales ejecutados y OK
- [ ] **Funcionalidad existente sin cambios** (crítico)

## Riesgos Identificados

| Riesgo | Probabilidad | Impacto | Mitigación |
|--------|--------------|---------|------------|
| TS strict rompe builds | Alta | Alto | @ts-expect-error + documentar |
| Tests no migran | Media | Alto | Adapter temporal |
| Path aliases rompen imports | Baja | Alto | Shims/barrels |
| Electron no arranca | Baja | Crítico | No mover src/, solo estructura |

## Próxima Fase

Una vez completada Fase 1 y mergeado PR, continuar con:

**[Fase 2: Migración Gradual](./FASE_02_migracion_gradual.md)** - Mover lógica a packages/ con shims.

---

**Última actualización**: Octubre 2025
**Responsable**: Equipo de desarrollo
**Revisión**: Arquitectura

