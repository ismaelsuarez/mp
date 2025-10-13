# Fase 6: Optimización (Bundle, Next.js, Electron)

**Estado**: ⏳ PENDIENTE (después de Fase 5)

**Duración estimada**: 3-5 días

**Rama**: `refactor/optimization`

## Objetivo

Optimizar tamaños de bundle, tiempos de build, startup de Electron, y configurar Next.js (si existe apps/web) con mejores prácticas de performance.

## Principio Fundamental

> "Build rápido, startup rápido, bundle pequeño. Analizar, optimizar, medir, comparar."

## Tareas Detalladas

### 1. Análisis Baseline (Antes de Optimizar)

#### 1.1 Medir métricas actuales

```bash
# Build time
time pnpm build:ts

# Bundle size
du -sh dist/

# Startup time (manual con stopwatch)
pnpm start
# Medir tiempo hasta que UI responde
```

Documentar en `docs/optimization/BASELINE.md`:

```markdown
# Baseline Metrics (Before Phase 6)

Fecha: [DATE]

## Build Time
- TypeScript build: XX segundos
- Electron build: XX segundos

## Bundle Size
- dist/ total: XX MB
- Main process: XX MB
- Renderer process: XX MB
- node_modules en asar: XX MB

## Startup Time
- Splash → Main window: XX segundos
- Main window → Interactive: XX segundos

## Memory Usage (Idle)
- Main process: XX MB
- Renderer process: XX MB
```

### 2. TypeScript Build Optimization

#### 2.1 tsconfig.json optimizations

```json
{
  "compilerOptions": {
    "incremental": true,
    "tsBuildInfoFile": ".tsbuildinfo",
    "skipLibCheck": true,
    "removeComments": true
  }
}
```

#### 2.2 Build paralelo por packages

Actualizar `package.json`:

```json
{
  "scripts": {
    "build": "pnpm -r --filter './packages/*' build && pnpm build:ts",
    "build:ts": "tsc -b tsconfig.json"
  }
}
```

### 3. Electron Builder Optimization

#### 3.1 Actualizar electron-builder config en package.json

```json
{
  "build": {
    "asar": true,
    "asarUnpack": [
      "**/*.node",
      "**/sdk/afip.ts-main/src/soap/wsdl/**"
    ],
    "compression": "maximum",
    "files": [
      "dist/**/*",
      "public/**/*",
      "templates/**/*",
      "!dist/**/*.map",
      "!dist/**/*.d.ts",
      "!**/*.ts",
      "!src/**/*",
      "!tests/**/*",
      "!coverage/**/*"
    ],
    "extraResources": [
      {
        "from": "sdk/afip.ts-main/src/soap/wsdl",
        "to": "sdk/afip.ts-main/src/soap/wsdl",
        "filter": ["**/*.wsdl"]
      }
    ],
    "win": {
      "target": {
        "target": "nsis",
        "arch": ["x64"]
      },
      "icon": "build/icon.ico"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": true,
      "allowToChangeInstallationDirectory": true,
      "license": "build/LICENSE.txt",
      "include": "build/installer.nsh",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "differentialPackage": true
    }
  }
}
```

#### 3.2 Optimizar dependencias en asar

**Identificar dependencias grandes innecesarias**:

```bash
pnpm exec npx asar extract dist/app.asar extracted/
du -sh extracted/node_modules/* | sort -h
```

**Considerar**:
- Eliminar devDependencies de producción
- Usar versiones lighter (ej: `pino` vs `winston`)
- Bundle solo lo necesario

### 4. Next.js Optimization (Si existe apps/web)

#### 4.1 next.config.js optimizado

```javascript
/** @type {import('next').NextConfig} */
const nextConfig = {
  reactStrictMode: true,
  swcMinify: true,
  
  // Optimización de imágenes
  images: {
    formats: ['image/webp', 'image/avif'],
    deviceSizes: [640, 750, 828, 1080, 1200],
    imageSizes: [16, 32, 48, 64, 96, 128, 256, 384]
  },
  
  // Optimización de fonts
  optimizeFonts: true,
  
  // Compresión
  compress: true,
  
  // Output standalone para deploy optimizado
  output: 'standalone',
  
  // Code splitting
  webpack: (config, { isServer }) => {
    if (!isServer) {
      config.optimization.splitChunks = {
        chunks: 'all',
        cacheGroups: {
          default: false,
          vendors: false,
          // Vendor chunk
          vendor: {
            name: 'vendor',
            chunks: 'all',
            test: /node_modules/,
            priority: 20
          },
          // Common chunk
          common: {
            name: 'common',
            minChunks: 2,
            chunks: 'all',
            priority: 10,
            reuseExistingChunk: true,
            enforce: true
          }
        }
      };
    }
    
    return config;
  },
  
  // Bundle analyzer (solo en análisis)
  ...(process.env.ANALYZE === 'true' && {
    webpack: (config) => {
      const { BundleAnalyzerPlugin } = require('webpack-bundle-analyzer');
      config.plugins.push(
        new BundleAnalyzerPlugin({
          analyzerMode: 'static',
          openAnalyzer: false,
          reportFilename: 'bundle-report.html'
        })
      );
      return config;
    }
  })
};

module.exports = nextConfig;
```

#### 4.2 Usar next/image y next/font

```typescript
// Antes
<img src="/logo.png" alt="Logo" />

// Después
import Image from 'next/image';
<Image src="/logo.png" alt="Logo" width={200} height={50} />

// Fonts
import { Inter } from 'next/font/google';
const inter = Inter({ subsets: ['latin'] });
```

#### 4.3 Lazy loading y code splitting

```typescript
// Lazy load componentes pesados
import dynamic from 'next/dynamic';

const HeavyComponent = dynamic(() => import('./HeavyComponent'), {
  loading: () => <p>Loading...</p>,
  ssr: false // Si no necesita SSR
});
```

#### 4.4 ISR para páginas estáticas

```typescript
// pages/docs/[slug].tsx
export async function getStaticProps({ params }) {
  return {
    props: { ... },
    revalidate: 3600 // Regenerar cada hora
  };
}
```

### 5. Bundle Analysis

#### 5.1 Instalar herramientas

```bash
pnpm add -D webpack-bundle-analyzer source-map-explorer
```

#### 5.2 Analizar bundle de Electron

```bash
# Generar sourcemaps
tsc --sourceMap

# Analizar
pnpm exec source-map-explorer dist/**/*.js --html bundle-analysis.html
```

#### 5.3 Identificar optimizaciones

Buscar:
- Dependencias duplicadas
- Módulos grandes innecesarios
- Código muerto

### 6. Optimización de Startup

#### 6.1 Lazy load de módulos pesados

```typescript
// src/main.ts

// Antes: Todo cargado al inicio
import { heavyModule } from './heavy';

// Después: Carga lazy
let heavyModule: any;

async function loadHeavyModule() {
  if (!heavyModule) {
    heavyModule = await import('./heavy');
  }
  return heavyModule;
}
```

#### 6.2 Splash screen mientras carga

```typescript
// src/main.ts

function createSplashWindow() {
  const splash = new BrowserWindow({
    width: 400,
    height: 300,
    transparent: true,
    frame: false,
    alwaysOnTop: true
  });
  
  splash.loadFile('public/splash.html');
  return splash;
}

app.on('ready', async () => {
  const splash = createSplashWindow();
  
  // Inicializar app en background
  await initializeApp();
  
  // Crear ventana principal
  const mainWindow = await createMainWindow();
  
  // Cerrar splash cuando main esté lista
  mainWindow.once('ready-to-show', () => {
    splash.close();
    mainWindow.show();
  });
});
```

#### 6.3 Diferir inicializaciones no críticas

```typescript
app.on('ready', async () => {
  // Crítico: crear ventana
  await createMainWindow();
  
  // NO crítico: diferir
  setTimeout(async () => {
    await initializeAutoUpdater();
    await initializeAnalytics();
  }, 3000);
});
```

### 7. Memory Optimization

#### 7.1 Límites de memoria para V8

```typescript
// src/main.ts
import { app } from 'electron';

app.commandLine.appendSwitch('js-flags', '--max-old-space-size=2048');
```

#### 7.2 Limpieza de recursos

```typescript
// Cleanup intervals, timers, listeners
app.on('before-quit', () => {
  // Clear intervals
  clearInterval(someInterval);
  
  // Remove listeners
  ipcMain.removeAllListeners();
  
  // Stop watchers
  watcherManager.stopAll();
});
```

### 8. Medir Mejoras

#### 8.1 docs/optimization/AFTER.md

```markdown
# After Optimization (Phase 6)

Fecha: [DATE]

## Build Time
- TypeScript build: XX segundos (**-Y%**)
- Electron build: XX segundos (**-Y%**)

## Bundle Size
- dist/ total: XX MB (**-Y%**)
- Main process: XX MB (**-Y%**)
- Renderer process: XX MB (**-Y%**)

## Startup Time
- Splash → Main window: XX segundos (**-Y%**)
- Main window → Interactive: XX segundos (**-Y%**)

## Memory Usage (Idle)
- Main process: XX MB (**-Y%**)
- Renderer process: XX MB (**-Y%**)

## Optimizations Applied

1. **Build**: Incremental TS, parallel builds
2. **Bundle**: ASAR compression, removed unused deps
3. **Startup**: Lazy load, splash screen, deferred init
4. **Memory**: V8 limits, resource cleanup
5. **Next.js** (if applicable): next/image, code splitting, ISR

## Comparison

| Metric | Before | After | Improvement |
|--------|--------|-------|-------------|
| Build time | Xs | Xs | -Y% |
| Bundle size | XMB | XMB | -Y% |
| Startup time | Xs | Xs | -Y% |
| Memory (idle) | XMB | XMB | -Y% |
```

### 9. Automatizar Análisis en CI

```yaml
# .github/workflows/bundle-size.yml

name: Bundle Size Analysis

on: [pull_request]

jobs:
  analyze:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - uses: pnpm/action-setup@v2
      - run: pnpm install
      - run: pnpm build
      
      - name: Analyze bundle
        run: |
          du -sh dist/ > bundle-size.txt
          cat bundle-size.txt
      
      - name: Comment PR with bundle size
        uses: actions/github-script@v6
        with:
          script: |
            const fs = require('fs');
            const size = fs.readFileSync('bundle-size.txt', 'utf8');
            github.rest.issues.createComment({
              issue_number: context.issue.number,
              owner: context.repo.owner,
              repo: context.repo.repo,
              body: `## Bundle Size\n\n\`\`\`\n${size}\n\`\`\``
            });
```

## Checklist de Aceptación

- [ ] Métricas baseline documentadas
- [ ] TypeScript build optimizado (incremental, skipLibCheck)
- [ ] Electron builder con asar + compression
- [ ] Bundle size reducido (al menos -10%)
- [ ] Startup time mejorado (al menos -15%)
- [ ] Next.js optimizado (si aplica)
- [ ] Bundle analysis ejecutado y revisado
- [ ] Lazy loading implementado para módulos pesados
- [ ] Splash screen durante carga
- [ ] Memory limits configurados
- [ ] Métricas "after" documentadas con comparación
- [ ] **Funcionalidad sin cambios**

## Objetivos de Mejora

- **Build time**: -20% o más
- **Bundle size**: -15% o más
- **Startup time**: -20% o más
- **Memory usage**: -10% o más

## Próxima Fase

**[Fase 7: Testing + Cobertura](./FASE_07_testing_cobertura.md)** - Coverage ≥80% con Vitest.

---

**Última actualización**: Octubre 2025

