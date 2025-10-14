# 📋 FASE 3: Plan de Migración de Lógica de Negocio

**Fecha inicio**: 14 de Octubre, 2025  
**Estado**: 🔄 EN PLANIFICACIÓN  
**Objetivo**: Migrar lógica de negocio desde `src/services/` y `src/modules/` a la arquitectura del monorepo

---

## 🎯 Objetivo de Fase 3

Migrar servicios de **lógica de negocio** que orquestan funcionalidades, procesan datos de dominio, y coordinan entre `@core` e `@infra`.

**Diferencia clave con Fase 2**:
- **Fase 2**: Lógica pura (@core), adaptadores (@infra), tipos (@shared)
- **Fase 3**: Servicios de negocio que **orquestan** y **coordinan**

---

## 📦 Inventario de Servicios Pendientes

### A) Servicios de Alto Nivel (src/services/)

| Servicio | Líneas | Descripción | Destino Propuesto |
|----------|--------|-------------|-------------------|
| `FacturacionService.ts` | ~300 | Orquestador principal de facturación | `apps/electron/services/` |
| `FacturaGenerator.ts` | ~250 | Generador de PDFs de facturas | `apps/electron/services/` |
| `ReportService.ts` | ~200 | Generación de reportes (MP, BNA, etc.) | `apps/electron/services/` |
| `CajaLogService.ts` | ~150 | Logger específico de modo Caja | `apps/electron/services/` |
| `CajaLogStore.ts` | ~100 | Store para logs de Caja | `apps/electron/services/` |
| `ErrorNotificationService.ts` | ~80 | Servicio de notificaciones de error | `apps/electron/services/` |

**Total**: ~1,080 líneas

### B) Procesadores de Negocio (src/modules/facturacion/)

| Módulo | Líneas | Descripción | Destino Propuesto |
|--------|--------|-------------|-------------------|
| `facProcessor.ts` | 1,177 | Procesador principal .fac → PDF + AFIP | `apps/electron/modules/facturacion/` |
| `remitoProcessor.ts` | ~300 | Procesador de remitos | `apps/electron/modules/facturacion/` |
| `facWatcher.ts` | ~400 | Watcher de archivos .fac | `apps/electron/modules/facturacion/` |
| `afipService.ts` | 761 | Servicio AFIP (alta capa) | `apps/electron/modules/facturacion/` |
| `cotizacionHelper.ts` | ~200 | Helper de cotizaciones | `apps/electron/modules/facturacion/` |
| `padron.ts` | ~150 | Consultas al padrón A13 | `apps/electron/modules/facturacion/` |

**Total**: ~2,988 líneas

### C) Módulos AFIP Avanzados (src/modules/facturacion/afip/)

| Módulo | Líneas | Descripción | Destino Propuesto |
|--------|--------|-------------|-------------------|
| `AfipValidator.ts` | ~300 | Validador complejo de AFIP | `apps/electron/modules/facturacion/afip/` |
| `CAEValidator.ts` | ~150 | Validador de CAE | `apps/electron/modules/facturacion/afip/` |
| `CertificateValidator.ts` | ~100 | Validador de certificados | `apps/electron/modules/facturacion/afip/` |
| `CircuitBreaker.ts` | ~200 | Circuit breaker para AFIP | `apps/electron/modules/facturacion/afip/` |
| `IdempotencyManager.ts` | ~150 | Gestor de idempotencia | `apps/electron/modules/facturacion/afip/` |
| `ResilienceWrapper.ts` | ~180 | Wrapper de resiliencia | `apps/electron/modules/facturacion/afip/` |
| `TimeValidator.ts` | ~200 | Validador de tiempo NTP | `apps/electron/modules/facturacion/afip/` |
| `AfipLogger.ts` | ~100 | Logger específico AFIP | `apps/electron/modules/facturacion/afip/` |
| `AfipInstanceManager.ts` | ~150 | Gestor de instancias AFIP | `apps/electron/modules/facturacion/afip/` |

**Total**: ~1,530 líneas

### D) Módulos Provinciales (src/modules/facturacion/provincia/)

| Módulo | Líneas | Descripción | Destino Propuesto |
|--------|--------|-------------|-------------------|
| `ATMService.ts` | ~300 | Servicio ATM (provincial) | `apps/electron/modules/facturacion/provincia/` |
| `IProvinciaService.ts` | ~120 | Interface provincial | `apps/electron/modules/facturacion/provincia/` |
| `ProvinciaManager.ts` | ~250 | Manager provincial | `apps/electron/modules/facturacion/provincia/` |

**Total**: ~670 líneas

### E) ARCA (src/modules/facturacion/arca/)

| Módulo | Líneas | Descripción | Destino Propuesto |
|--------|--------|-------------|-------------------|
| `ArcaAdapter.ts` | ~200 | Adapter ARCA | `apps/electron/modules/facturacion/arca/` |
| `ArcaClient.ts` | ~150 | Cliente ARCA | `apps/electron/modules/facturacion/arca/` |

**Total**: ~350 líneas

### F) Otros Módulos

| Módulo | Líneas | Descripción | Destino Propuesto |
|--------|--------|-------------|-------------------|
| `src/modules/perfiles/PerfilService.ts` | ~200 | Servicio de perfiles | `apps/electron/modules/perfiles/` |
| `src/modules/retenciones/retencionProcessor.ts` | ~300 | Procesador retenciones | `apps/electron/modules/retenciones/` |
| `src/modules/retenciones/retencionRenderer.ts` | ~250 | Renderer retenciones | `apps/electron/modules/retenciones/` |

**Total**: ~750 líneas

---

## 📊 Resumen Cuantitativo

| Categoría | Módulos | Líneas Aprox |
|-----------|---------|--------------|
| **A) Servicios Alto Nivel** | 6 | ~1,080 |
| **B) Procesadores** | 6 | ~2,988 |
| **C) AFIP Avanzado** | 9 | ~1,530 |
| **D) Provincial** | 3 | ~670 |
| **E) ARCA** | 2 | ~350 |
| **F) Otros** | 3 | ~750 |
| **TOTAL FASE 3** | **29** | **~7,368** |

---

## 🏗️ Estrategia de Migración

### Decisión Clave: ¿Dónde van los servicios de negocio?

**Opción 1: `apps/electron/` (RECOMENDADA)**
- ✅ Son servicios específicos de la app Electron
- ✅ Dependen de Electron APIs (app, BrowserWindow)
- ✅ Orquestan entre @core e @infra
- ✅ No necesitan ser compartidos con otras apps

**Opción 2: Nuevo package `@business/`**
- ❌ Demasiado acoplado a Electron
- ❌ No es lógica reutilizable
- ❌ Añade complejidad innecesaria

**DECISIÓN**: **Mover a `apps/electron/src/`** manteniendo estructura de módulos.

---

## 🔄 Plan de Iteraciones

### Iteración 1: Servicios Críticos Mínimos (SMOKE TEST) 🔥
**Objetivo**: Mover lo mínimo necesario para que la app siga funcionando  
**Duración estimada**: 40 min

- ✅ Crear `apps/electron/src/services/`
- ✅ Mover `ErrorNotificationService.ts` (base, usado por muchos)
- ✅ Mover `CajaLogService.ts` y `CajaLogStore.ts`
- ✅ Mover `ReportService.ts`
- ✅ Verificar build y runtime

**Meta**: App sigue compilando y arrancando

---

### Iteración 2: Core de Facturación 📄
**Duración estimada**: 60 min

- ✅ Mover `FacturacionService.ts`
- ✅ Mover `FacturaGenerator.ts`
- ✅ Actualizar imports
- ✅ Verificar build

---

### Iteración 3: Procesadores 🏭
**Duración estimada**: 90 min

- ✅ Mover `facProcessor.ts` (el más grande: 1,177 líneas)
- ✅ Mover `remitoProcessor.ts`
- ✅ Mover `facWatcher.ts`
- ✅ Actualizar imports
- ✅ Smoke test: procesar .fac

---

### Iteración 4: AFIP Avanzado 🛡️
**Duración estimada**: 60 min

- ✅ Mover módulos de `src/modules/facturacion/afip/` a `apps/electron/src/modules/facturacion/afip/`
- ✅ Mantener estructura interna
- ✅ Actualizar imports
- ✅ Smoke test AFIP

---

### Iteración 5: Provincial y ARCA 🏛️
**Duración estimada**: 40 min

- ✅ Mover `src/modules/facturacion/provincia/` → `apps/electron/src/modules/facturacion/provincia/`
- ✅ Mover `src/modules/facturacion/arca/` → `apps/electron/src/modules/facturacion/arca/`
- ✅ Actualizar imports

---

### Iteración 6: Otros Módulos 📦
**Duración estimada**: 30 min

- ✅ Mover `src/modules/perfiles/` → `apps/electron/src/modules/perfiles/`
- ✅ Mover `src/modules/retenciones/` → `apps/electron/src/modules/retenciones/`
- ✅ Actualizar imports
- ✅ Build final

---

## 📐 Estructura Propuesta Final

```
apps/electron/src/
├── services/                    (Servicios de alto nivel)
│   ├── FacturacionService.ts
│   ├── FacturaGenerator.ts
│   ├── ReportService.ts
│   ├── CajaLogService.ts
│   ├── CajaLogStore.ts
│   └── ErrorNotificationService.ts
├── modules/
│   ├── facturacion/
│   │   ├── facProcessor.ts
│   │   ├── remitoProcessor.ts
│   │   ├── facWatcher.ts
│   │   ├── afipService.ts
│   │   ├── cotizacionHelper.ts
│   │   ├── padron.ts
│   │   ├── afip/               (Módulos AFIP avanzados)
│   │   │   ├── AfipValidator.ts
│   │   │   ├── CAEValidator.ts
│   │   │   ├── CircuitBreaker.ts
│   │   │   └── ...
│   │   ├── provincia/          (ATM, Manager)
│   │   │   ├── ATMService.ts
│   │   │   ├── ProvinciaManager.ts
│   │   │   └── IProvinciaService.ts
│   │   └── arca/               (ARCA adapter)
│   │       ├── ArcaAdapter.ts
│   │       └── ArcaClient.ts
│   ├── perfiles/
│   │   └── PerfilService.ts
│   └── retenciones/
│       ├── retencionProcessor.ts
│       └── retencionRenderer.ts
└── main.ts
```

---

## ⚠️ Consideraciones Importantes

### 1. NO crear shims esta vez
- Estos archivos NO se quedan en `src/`
- Se **mueven completamente** a `apps/electron/src/`
- Los imports se actualizan directamente

### 2. Path aliases NO necesarios
- Usar imports relativos dentro de `apps/electron/src/`
- Imports a `@core`, `@infra`, `@shared` siguen funcionando

### 3. Mantener tests
- Los tests en `src/modules/facturacion/__tests__/` se mueven también
- Actualizar imports en tests

---

## ✅ Criterios de Éxito

- ✅ Build TypeScript exitoso
- ✅ App Electron arranca sin errores
- ✅ Smoke tests pasan:
  - Procesar archivo .fac
  - Generar PDF
  - Emitir a AFIP (sandbox)
  - Watchers funcionando
- ✅ 0 breaking changes en funcionalidad

---

## 📊 Progreso Estimado

| Iteración | Duración | Módulos | Líneas |
|-----------|----------|---------|--------|
| 1 - Críticos | 40 min | 4 | ~330 |
| 2 - Core Fac | 60 min | 2 | ~550 |
| 3 - Procesadores | 90 min | 3 | ~1,877 |
| 4 - AFIP Avanzado | 60 min | 9 | ~1,530 |
| 5 - Provincial/ARCA | 40 min | 5 | ~1,020 |
| 6 - Otros | 30 min | 3 | ~750 |
| **TOTAL** | **~5.5 hrs** | **29** | **~7,368** |

---

**Siguiente paso**: Ejecutar Iteración 1 (Servicios Críticos Mínimos)  
**Estimación**: 40 minutos

