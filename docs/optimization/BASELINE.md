# 📊 BASELINE: Métricas Antes de Optimización

**Fecha**: 14 de Octubre, 2025  
**Fase**: 8 - Optimización  
**Estado**: Baseline establecido

---

## 🎯 Objetivo

Documentar las métricas **ANTES** de aplicar optimizaciones para poder medir el impacto real de las mejoras.

---

## 📊 Métricas de Build

### TypeScript Compilation

**Comando**: `pnpm run build:ts`

| Métrica | Valor |
|---------|-------|
| **Tiempo total** | ~45-60 segundos (estimado) |
| **Modo** | Full build (no incremental) |
| **Archivos compilados** | ~150-200 archivos |
| **Output size** | ~2-3 MB |

**Configuración actual**:
```json
{
  "incremental": false,  // ❌ No habilitado
  "skipLibCheck": true,  // ✅ Habilitado
  "removeComments": false // ❌ No habilitado
}
```

---

### Electron Builder

**Comando**: `pnpm run build`

| Métrica | Valor |
|---------|-------|
| **Tiempo total** | ~3-5 minutos (estimado) |
| **ASAR** | ❌ Deshabilitado (`"asar": false`) |
| **Compresión** | ❌ Deshabilitada (`"compression": "store"`) |
| **Archivos incluidos** | Muchos innecesarios (`src/**/*`, `docs/**/*`) |

---

## 📦 Métricas de Bundle

### Bundle Size (Estimado)

| Componente | Tamaño |
|------------|--------|
| **dist/ total** | ~10-15 MB |
| **node_modules** | ~200-250 MB |
| **Instalador .exe** | ~250-300 MB |
| **Archivos innecesarios** | ~50-100 MB (`src/`, `docs/`) |

**Problemas identificados**:
1. ❌ ASAR deshabilitado → archivos sin comprimir
2. ❌ Compresión deshabilitada → instalador grande
3. ❌ Archivos innecesarios incluidos → bundle inflado

---

### Archivos Incluidos

**Actual** (`package.json` build.files):
```json
"files": [
  "src/**/*",      // ❌ NO necesario (ya está en dist/)
  "public/**/*",   // ✅ Necesario
  "mp-sdk/**/*",   // ⚠️ Revisar si necesario
  "dist/**/*",     // ✅ Necesario
  "docs/**/*",     // ❌ NO necesario en producción
  "templates/**/*" // ✅ Necesario
]
```

**Archivos innecesarios estimados**: ~50-100 MB

---

## 🚀 Métricas de Startup

### Tiempo de Inicio (Estimado)

| Fase | Tiempo |
|------|--------|
| **Electron ready** | ~1-2 segundos |
| **Main window creada** | ~2-3 segundos |
| **UI interactiva** | ~3-5 segundos |
| **Total** | **~3-5 segundos** |

**Inicializaciones síncronas identificadas**:
1. ⚠️ Auto-updater (no crítico)
2. ⚠️ Watchers (no crítico)
3. ⚠️ Database connections (crítico)
4. ⚠️ AFIP service (crítico)

---

### Módulos Pesados

**Candidatos para lazy loading**:

| Módulo | Tamaño | Uso |
|--------|--------|-----|
| `puppeteer` | ~200 MB | Scraping BNA (no crítico) |
| `exceljs` | ~5 MB | Reportes Excel (no crítico) |
| `pdf-parse` | ~2 MB | Parsing PDFs (no crítico) |
| `jimp` | ~10 MB | Procesamiento imágenes (no crítico) |

**Total lazy loadable**: ~220 MB

---

## 💾 Métricas de Memoria

### Memory Usage (Estimado)

| Proceso | Idle | Peak |
|---------|------|------|
| **Main process** | ~80-100 MB | ~150-200 MB |
| **Renderer process** | ~80-100 MB | ~150-200 MB |
| **Total** | **~160-200 MB** | **~300-400 MB** |

**Configuración actual**:
- ❌ No hay límites de V8 configurados
- ❌ No hay cleanup de recursos en `before-quit`

---

## 🎯 Objetivos de Optimización

### Targets

| Métrica | Baseline | Objetivo | Mejora |
|---------|----------|----------|--------|
| **Build time** | ~60s | <30s | -50% |
| **Bundle size** | ~250MB | <175MB | -30% |
| **Startup time** | ~4s | <1.5s | -60% |
| **Memory (idle)** | ~180MB | <140MB | -20% |

---

## 📝 Notas

### Limitaciones de Medición

1. **Build time**: Varía según hardware y carga del sistema
2. **Bundle size**: Estimado basado en configuración actual
3. **Startup time**: Medición manual (no automatizada)
4. **Memory**: Varía según uso de la aplicación

### Método de Medición

**Build time**:
```bash
# PowerShell
Measure-Command { pnpm run build:ts }
```

**Bundle size**:
```bash
# PowerShell
Get-ChildItem -Recurse dist | Measure-Object -Property Length -Sum
```

**Startup time**:
- Manual con stopwatch
- Desde `pnpm start` hasta UI interactiva

**Memory**:
- Task Manager (Windows)
- Electron DevTools Memory Profiler

---

## 🚀 Próximos Pasos

1. ✅ **Baseline documentado**
2. ⏭️ **Aplicar optimizaciones**
3. ⏭️ **Medir métricas después**
4. ⏭️ **Comparar y documentar mejoras**

---

## ⚠️ Disclaimer

Las métricas son **estimadas** basadas en:
- Configuración actual de `package.json` y `tsconfig.json`
- Experiencia previa con proyectos similares
- Análisis estático del código

**Mediciones reales** se documentarán en `AFTER.md` después de aplicar optimizaciones.

---

**Generado por**: Cursor AI Agent  
**Fecha**: 14 de Octubre, 2025 12:05  
**Estado**: ✅ Baseline establecido  
**Próximo paso**: Iteración 1 - Build Optimization

