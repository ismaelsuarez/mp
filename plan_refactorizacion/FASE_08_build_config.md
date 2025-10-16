# Fase 8: Build & Config Profesional

**Estado**: ⏳ PENDIENTE (después de Fase 7)

**Duración estimada**: 3-5 días

**Rama**: `refactor/professional-config`

## Objetivo

Configurar ESLint y Prettier estrictos, eliminar console.log en producción, optimizar builds de Electron para Windows, implementar auto-update, y asegurar que no haya warnings ni errores.

## Principio Fundamental

> "Zero warnings, zero console.log en prod, builds limpios, código formateado consistente."

## Tareas Detalladas

### 1. ESLint Estricto

#### 1.1 Instalar dependencias

```bash
pnpm add -D eslint @typescript-eslint/parser @typescript-eslint/eslint-plugin
pnpm add -D eslint-config-prettier eslint-plugin-prettier
pnpm add -D eslint-plugin-import eslint-plugin-node
```

#### 1.2 .eslintrc.json

```json
{
  "root": true,
  "parser": "@typescript-eslint/parser",
  "parserOptions": {
    "ecmaVersion": 2020,
    "sourceType": "module",
    "project": "./tsconfig.json"
  },
  "env": {
    "node": true,
    "es6": true
  },
  "extends": [
    "eslint:recommended",
    "plugin:@typescript-eslint/recommended",
    "plugin:@typescript-eslint/recommended-requiring-type-checking",
    "prettier"
  ],
  "plugins": [
    "@typescript-eslint",
    "import",
    "prettier"
  ],
  "rules": {
    // TypeScript
    "@typescript-eslint/explicit-function-return-type": "warn",
    "@typescript-eslint/no-explicit-any": "error",
    "@typescript-eslint/no-unused-vars": ["error", {
      "argsIgnorePattern": "^_",
      "varsIgnorePattern": "^_"
    }],
    "@typescript-eslint/no-floating-promises": "error",
    "@typescript-eslint/await-thenable": "error",
    "@typescript-eslint/no-misused-promises": "error",
    
    // Console (prohibido en prod)
    "no-console": ["error", { "allow": ["warn", "error"] }],
    
    // Import/Export
    "import/order": ["error", {
      "groups": [
        "builtin",
        "external",
        "internal",
        "parent",
        "sibling",
        "index"
      ],
      "newlines-between": "always",
      "alphabetize": {
        "order": "asc",
        "caseInsensitive": true
      }
    }],
    "import/no-duplicates": "error",
    "import/newline-after-import": "error",
    
    // General
    "no-throw-literal": "error",
    "prefer-const": "error",
    "no-var": "error",
    "object-shorthand": "error",
    "prefer-template": "error",
    "prefer-arrow-callback": "error",
    
    // Prettier
    "prettier/prettier": "error"
  },
  "ignorePatterns": [
    "node_modules",
    "dist",
    "coverage",
    "build",
    "*.js"
  ]
}
```

#### 1.3 .eslintignore

```
node_modules/
dist/
coverage/
build/
*.config.js
scripts/*.js
sdk/afip.ts-main/
```

#### 1.4 Scripts

```json
{
  "scripts": {
    "lint": "eslint . --ext .ts,.tsx --max-warnings 0",
    "lint:fix": "eslint . --ext .ts,.tsx --fix"
  }
}
```

### 2. Prettier

#### 2.1 .prettierrc.json

```json
{
  "semi": true,
  "trailingComma": "es5",
  "singleQuote": true,
  "printWidth": 100,
  "tabWidth": 2,
  "useTabs": false,
  "arrowParens": "always",
  "endOfLine": "lf"
}
```

#### 2.2 .prettierignore

```
node_modules
dist
coverage
build
pnpm-lock.yaml
*.md
```

#### 2.3 Scripts

```json
{
  "scripts": {
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### 3. Eliminar console.log en Producción

#### 3.1 Buscar todos los console.log

```bash
pnpm exec grep -r "console\.log" src/ packages/ apps/ --exclude-dir=node_modules
```

#### 3.2 Reemplazar con logger

```typescript
// Antes
console.log('Processing file:', filename);

// Después
import { logger } from '@infra/logger';
logger.debug('Processing file', { filename });
```

#### 3.3 Script de verificación pre-commit (opcional)

```bash
#!/bin/bash
# .husky/pre-commit

# Buscar console.log prohibidos
if grep -r "console\.log" src/ packages/ apps/ --exclude-dir=node_modules; then
  echo "Error: console.log found. Use logger instead."
  exit 1
fi
```

### 4. Electron Build Profesional

#### 4.1 package.json - electron-builder optimizado

```json
{
  "build": {
    "appId": "com.tcmza.tcmp",
    "productName": "TC-MP",
    "artifactName": "TC-MP-${version}.${ext}",
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
      "package.json",
      "!**/*.ts",
      "!**/*.map",
      "!**/*.d.ts",
      "!src/**/*",
      "!tests/**/*",
      "!coverage/**/*",
      "!docs/**/*",
      "!scripts/**/*",
      "!.github/**/*"
    ],
    "extraResources": [
      {
        "from": "sdk/afip.ts-main/src/soap/wsdl",
        "to": "sdk/afip.ts-main/src/soap/wsdl",
        "filter": ["**/*.wsdl"]
      }
    ],
    "directories": {
      "buildResources": "build",
      "output": "release"
    },
    "win": {
      "target": [
        {
          "target": "nsis",
          "arch": ["x64"]
        }
      ],
      "icon": "build/icon.ico",
      "publisherName": "TODO-Computacion",
      "requestedExecutionLevel": "asInvoker",
      "verifyUpdateCodeSignature": false,
      "certificateFile": "build/cert.pfx",
      "certificatePassword": "${CERT_PASSWORD}"
    },
    "nsis": {
      "oneClick": false,
      "perMachine": true,
      "allowElevation": true,
      "allowToChangeInstallationDirectory": true,
      "installerIcon": "build/icon.ico",
      "uninstallerIcon": "build/icon.ico",
      "installerHeaderIcon": "build/icon.ico",
      "createDesktopShortcut": true,
      "createStartMenuShortcut": true,
      "shortcutName": "TC-MP",
      "license": "build/LICENSE.txt",
      "include": "build/installer.nsh",
      "differentialPackage": true
    },
    "publish": [
      {
        "provider": "github",
        "owner": "ismaelsuarez",
        "repo": "mp-updates",
        "releaseType": "release"
      }
    ]
  }
}
```

#### 4.2 Auto-Update configurado

```typescript
// src/main.ts

import { autoUpdater } from 'electron-updater';
import { logger } from '@infra/logger';

// Configurar auto-updater
autoUpdater.logger = logger;
autoUpdater.autoDownload = false;
autoUpdater.autoInstallOnAppQuit = true;

// Check for updates on startup
app.on('ready', async () => {
  // Diferir check de updates (no bloquear startup)
  setTimeout(() => {
    if (process.env.NODE_ENV === 'production') {
      checkForUpdates();
    }
  }, 5000);
});

async function checkForUpdates(): Promise<void> {
  try {
    const result = await autoUpdater.checkForUpdates();
    
    if (result?.updateInfo) {
      logger.info('Update available', {
        version: result.updateInfo.version
      });
      
      // Notificar usuario
      const response = await dialog.showMessageBox({
        type: 'info',
        title: 'Update Available',
        message: `A new version (${result.updateInfo.version}) is available. Download now?`,
        buttons: ['Yes', 'Later']
      });
      
      if (response.response === 0) {
        await autoUpdater.downloadUpdate();
      }
    }
  } catch (error) {
    logger.error('Error checking for updates', error as Error);
  }
}

// Auto-updater events
autoUpdater.on('update-downloaded', () => {
  dialog.showMessageBox({
    type: 'info',
    title: 'Update Ready',
    message: 'Update downloaded. It will be installed on restart.',
    buttons: ['Restart Now', 'Later']
  }).then((result) => {
    if (result.response === 0) {
      autoUpdater.quitAndInstall();
    }
  });
});
```

### 5. Build Scripts Optimizados

#### 5.1 package.json scripts

```json
{
  "scripts": {
    "prebuild": "pnpm lint && pnpm typecheck && pnpm test",
    "build": "pnpm build:ts && electron-builder -w",
    "build:ts": "tsc -p tsconfig.json",
    "build:prod": "NODE_ENV=production pnpm build",
    "release": "pnpm prebuild && pnpm build:ts && electron-builder -w --publish always",
    "release:draft": "pnpm prebuild && pnpm build:ts && electron-builder -w --publish never",
    "typecheck": "tsc --noEmit",
    "lint": "eslint . --ext .ts,.tsx --max-warnings 0",
    "lint:fix": "eslint . --ext .ts,.tsx --fix",
    "format": "prettier --write .",
    "format:check": "prettier --check ."
  }
}
```

### 6. Git Hooks con Husky (opcional)

#### 6.1 Instalar husky

```bash
pnpm add -D husky lint-staged
pnpm exec husky install
```

#### 6.2 .husky/pre-commit

```bash
#!/usr/bin/env sh
. "$(dirname -- "$0")/_/husky.sh"

pnpm lint-staged
```

#### 6.3 lint-staged config

```json
{
  "lint-staged": {
    "*.{ts,tsx}": [
      "eslint --fix",
      "prettier --write"
    ],
    "*.{json,md}": [
      "prettier --write"
    ]
  }
}
```

### 7. Limpieza Final de Shims (Fase 2)

Revisar `docs/cleanup/SHIMS_TO_REMOVE.md` y eliminar shims si ya no se usan:

```bash
# Verificar que nadie importa desde ubicaciones viejas
pnpm exec grep -r "from.*src/types" packages/ apps/

# Si no hay resultados, eliminar shims
rm src/types/factura.ts
```

### 8. Verificación Pre-Release

#### 8.1 Checklist de verificación

```markdown
# Pre-Release Checklist

- [ ] `pnpm lint` pasa sin warnings
- [ ] `pnpm typecheck` pasa sin errores
- [ ] `pnpm test` pasa al 100%
- [ ] `pnpm test:coverage` ≥80%
- [ ] `pnpm format:check` pasa
- [ ] No hay console.log en src/, packages/, apps/
- [ ] Build compila sin errores: `pnpm build:ts`
- [ ] Electron build completa: `pnpm build`
- [ ] Instalador se genera correctamente
- [ ] App arranca sin errores
- [ ] Smoke tests manuales pasan
- [ ] Auto-update funciona (test con versión fake)
- [ ] README.md actualizado
- [ ] CHANGELOG.md actualizado con cambios de versión
```

### 9. CI Final - Everything Passing

```yaml
# .github/workflows/ci.yml

name: CI

on:
  push:
    branches: [2.0.0, main]
  pull_request:
    branches: [2.0.0, main]

jobs:
  lint:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - run: pnpm install --frozen-lockfile
      
      - name: Lint
        run: pnpm lint
      
      - name: Format check
        run: pnpm format:check
  
  test:
    runs-on: windows-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - run: pnpm install --frozen-lockfile
      
      - name: Type check
        run: pnpm typecheck
      
      - name: Test with coverage
        run: pnpm test:coverage
      
      - name: Upload coverage
        uses: codecov/codecov-action@v3
        with:
          files: ./coverage/lcov.info
  
  build:
    runs-on: windows-latest
    needs: [lint, test]
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version-file: '.nvmrc'
      - uses: pnpm/action-setup@v2
        with:
          version: 9
      - run: pnpm install --frozen-lockfile
      
      - name: Build TypeScript
        run: pnpm build:ts
      
      - name: Build Electron
        run: pnpm build
      
      - name: Upload artifacts
        uses: actions/upload-artifact@v3
        with:
          name: electron-build
          path: release/
```

## Checklist de Aceptación

- [ ] ESLint configurado y pasando sin warnings
- [ ] Prettier configurado y código formateado
- [ ] Zero console.log en prod (verificado)
- [ ] Electron builder optimizado (asar, compression, files)
- [ ] Auto-update implementado y testeado
- [ ] Build scripts optimizados
- [ ] Git hooks configurados (opcional)
- [ ] Shims removidos (si aplica)
- [ ] Pre-release checklist completo
- [ ] CI passing al 100%
- [ ] **Funcionalidad sin cambios**

## Métricas de Éxito

- **ESLint warnings**: 0
- **TypeScript errors**: 0
- **console.log en prod**: 0
- **Build success rate**: 100%
- **CI pass rate**: 100%

## Próxima Fase

**[Fase 9: Documentación + Homologación](./FASE_09_documentacion.md)** - Docs completas + checklist final.

---

**Última actualización**: Octubre 2025

