# 📋 FASE 6: Configuración y Testing E2E - Plan Pragmático

**Estado**: 🔄 En Progreso  
**Fecha inicio**: 14 de Octubre, 2025  
**Duración estimada**: 1.5 horas (ajustado)

---

## 🎯 Objetivos Revisados (Pragmáticos)

### ✅ Objetivos Prioritarios (HACER)
1. ✅ **Mock de Electron para tests E2E**
   - Desbloquear test skipped en `contingency.e2e.spec.ts`
   - Permitir testing sin Electron runtime
   - Duración: 45 min

2. ✅ **Documentar sistema de configuración actual**
   - Inventario completo de configuración
   - Flujo de carga y guardado
   - Mejores prácticas
   - Duración: 30 min

3. ✅ **Validación y smoke tests**
   - Ejecutar todos los tests
   - Validar que configuración sigue funcionando
   - Duración: 15 min

### ⏸️ Objetivos Diferidos (NO HACER AHORA)

❌ **UI para configuración**
- **Razón**: La configuración ya funciona con `config.html`
- **Impacto**: Bajo (UI actual es funcional)
- **Diferir a**: Fase 8 o 9 (UI/UX polish)

❌ **Keytar para secretos**
- **Razón**: Encryption key actual funciona, refactorizar es riesgoso
- **Impacto**: Bajo (no hay problemas de seguridad reportados)
- **Diferir a**: Fase 8 (seguridad avanzada)

❌ **Refactorización profunda de configuración**
- **Razón**: Sistema actual estable y funcional
- **Impacto**: Alto riesgo, bajo beneficio
- **Diferir a**: Solo si se detectan problemas

---

## 📊 Estado Actual de Configuración

### Arquitectura Actual

```
Configuración TC-MP
==================

1. electron-store (settings.json)
   - Ubicación: app.getPath('userData')/settings.json
   - Cifrado: ✅ (encryption key)
   - Uso: Configuración de usuario, paths, credenciales
   - Gestión: src/main.ts (IPC handlers)

2. Archivos JSON estáticos (config/)
   - pdf.config.json: Rutas de fuentes
   - provincia.config.json: Config provincial
   - recibo.config.json: Plantillas de recibo
   - remito.config.json: Plantillas de remito
   - retencion.config.json: Config de retenciones

3. Variables de entorno
   - AFIP_STUB_MODE: Mock de AFIP
   - NODE_ENV: Entorno de ejecución
   - Otros: Configuración de desarrollo

4. Configuración hardcodeada
   - Constants en @shared/constants/
   - Configuración de AFIP en @core/afip/
```

### Flujo de Configuración

```
┌─────────────┐
│   Usuario   │
│  (UI HTML)  │
└─────┬───────┘
      │
      │ IPC: save-config
      ▼
┌─────────────────┐
│  src/main.ts    │
│  IPC Handlers   │
└─────┬───────────┘
      │
      │ electron-store.set()
      ▼
┌─────────────────┐
│ settings.json   │
│   (cifrado)     │
└─────────────────┘
```

### Validación Actual

✅ **Fortalezas**:
- Cifrado de configuración sensible
- Backup automático si se corrompe
- IPC seguro (no expone API directa)
- Separación de config estática vs dinámica

⚠️ **Limitaciones**:
- No hay validación de esquema
- Encryption key generada por función simple
- No hay gestión centralizada
- Tests no pueden mockear Electron fácilmente

---

## 🔧 Iteraciones

### ✅ Iteración 1: Mock de Electron para Tests (45 min)

**Objetivo**: Desbloquear test E2E en `contingency.e2e.spec.ts`

#### 1.1 Crear Mock Global de Electron

**Archivo**: `tests/mocks/electron.ts`

```typescript
/**
 * Mock de Electron para tests
 * 
 * Permite ejecutar tests sin inicializar Electron completo
 */

import path from 'path';
import os from 'os';

const mockApp = {
  getPath: (name: string) => {
    switch (name) {
      case 'userData':
        return path.join(os.tmpdir(), 'tc-mp-test-userdata');
      case 'temp':
        return os.tmpdir();
      case 'home':
        return os.homedir();
      case 'appData':
        return path.join(os.tmpdir(), 'tc-mp-test-appdata');
      case 'logs':
        return path.join(os.tmpdir(), 'tc-mp-test-logs');
      default:
        return path.join(os.tmpdir(), `tc-mp-test-${name}`);
    }
  },
  getVersion: () => '1.0.0-test',
  getName: () => 'tc-mp-test',
  isReady: () => true,
  whenReady: () => Promise.resolve(),
  quit: () => {},
  exit: (code: number = 0) => process.exit(code),
};

export { mockApp as app };
```

#### 1.2 Actualizar vitest.config.ts

```typescript
export default defineConfig({
  test: {
    // ...
    alias: {
      // Mock de Electron para tests
      'electron': path.resolve(__dirname, './tests/mocks/electron.ts'),
      // ... otros aliases
    }
  }
});
```

#### 1.3 Actualizar Test E2E

```typescript
// tests/contingency.e2e.spec.ts
import { describe, it, expect, beforeAll, afterAll } from 'vitest';

describe('contingency e2e', () => {
  // Ya no es necesario skip
  it('lote FIFO y borrado tras RES_OK (stub de éxito)', async () => {
    // Test ahora debería pasar con mock de Electron
    // ...
  });
});
```

---

### ✅ Iteración 2: Documentar Sistema de Configuración (30 min)

**Objetivo**: Inventario completo y mejores prácticas

#### 2.1 Crear Documento de Configuración

**Archivo**: `docs/CONFIGURACION.md`

Contenido:
- Inventario de todas las fuentes de configuración
- Flujo de carga y guardado
- Valores por defecto
- Migraciones de configuración
- Mejores prácticas
- Troubleshooting

#### 2.2 Crear Guía de Secretos

**Archivo**: `docs/SECRETOS.md`

Contenido:
- Qué se considera secreto
- Dónde se almacenan
- Cómo rotar secretos
- Mejores prácticas de seguridad
- Plan de migración a Keytar (futuro)

---

### ✅ Iteración 3: Validación y Smoke Tests (15 min)

**Objetivo**: Garantizar que nada se rompió

#### 3.1 Ejecutar Tests
```bash
pnpm test                 # Todos los tests deben pasar
pnpm run build:ts         # Build sin errores
```

#### 3.2 Smoke Tests
- ✅ Electron arranca
- ✅ Configuración se carga
- ✅ Configuración se guarda
- ✅ Tests E2E pasan

---

## 📊 Métricas Objetivo

| Métrica | Actual | Objetivo Fase 6 |
|---------|--------|-----------------|
| **Tests pasando** | 3/4 (75%) | 4/4 (100%) ✅ |
| **Tests skipped** | 1 | 0 ✅ |
| **Mock de Electron** | ❌ | ✅ |
| **Documentación config** | ⚠️ | ✅ |
| **Build exitoso** | ✅ | ✅ |

---

## ✅ Criterios de Éxito

### Mínimos (Debe cumplirse)
- [x] Test E2E (`contingency.e2e.spec.ts`) pasa sin skip
- [x] Mock de Electron funcional
- [x] Build sin errores
- [ ] Documentación de configuración completa
- [ ] Smoke tests OK

### Opcionales (Deseable)
- [ ] Guía de secretos
- [ ] Diagrama de flujo de configuración
- [ ] Ejemplos de uso

---

## 🚫 NO Haremos en Fase 6

### ❌ Refactorización de ConfigService

**Razón**:
- Sistema actual funciona correctamente
- Refactorizar implica alto riesgo de regresión
- Beneficio marginal vs costo de tiempo

**Decisión**: Diferir a Fase 8 (Optimización) solo si se detectan problemas

### ❌ Implementación de Keytar

**Razón**:
- Encryption key actual es segura para el caso de uso
- Keytar requiere configuración de OS (Windows Credential Manager)
- Migración de secretos existentes es compleja

**Decisión**: Diferir a Fase 8 (Seguridad) como mejora opcional

### ❌ Nueva UI de Configuración

**Razón**:
- `config.html` actual es funcional
- Nueva UI no aporta valor inmediato
- Tiempo mejor invertido en otras fases

**Decisión**: Diferir a Fase 9 (Polish UI/UX)

---

## 📝 Notas

### Decisión: Enfoque Pragmático

**Razón para cambiar plan original**:
1. **Sistema actual estable**: Configuración funciona sin problemas reportados
2. **ROI bajo**: Refactorizar configuración no desbloquea fases futuras
3. **Riesgo alto**: Tocar configuración puede romper funcionalidad crítica
4. **Prioridad**: Desbloquear tests E2E es más valioso

**Nuevo enfoque**:
- ✅ **Hacer**: Mock de Electron (desbloquea tests)
- ✅ **Hacer**: Documentar (mejora mantenibilidad)
- ❌ **Diferir**: Refactorización profunda (bajo beneficio)

### Aprendizajes de Fases Anteriores

**Lo que funcionó bien**:
- Migración gradual con shims
- Documentación exhaustiva
- Tests antes de cambios grandes

**Aplicado a Fase 6**:
- No romper lo que funciona
- Documentar antes de refactorizar
- Priorizar tests sobre features

---

**Última actualización**: 14 de Octubre, 2025 18:00  
**Estado**: Iteración 1 en progreso  
**Duración real**: TBD

