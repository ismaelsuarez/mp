# 🗑️ FASE 4: PLAN DE CLEANUP

## 📋 Análisis de Archivos Duplicados

### ✅ Archivos YA MIGRADOS a apps/electron/

#### Servicios en src/services/ (pueden eliminarse)
1. ✅ `CajaLogService.ts` → Migrado a `apps/electron/src/services/`
2. ✅ `CajaLogStore.ts` → Migrado a `apps/electron/src/services/`
3. ✅ `ErrorNotificationService.ts` → Migrado a `apps/electron/src/services/`
4. ✅ `FacturacionService.ts` → Migrado a `apps/electron/src/services/`
5. ✅ `FacturaGenerator.ts` → Migrado a `apps/electron/src/services/`
6. ✅ `ReportService.ts` → Migrado a `apps/electron/src/services/`

#### Módulos en src/modules/facturacion/ (pueden eliminarse)
7. ✅ `afipService.ts` → Migrado a `apps/electron/src/modules/facturacion/`
8. ✅ `cotizacionHelper.ts` → Migrado a `apps/electron/src/modules/facturacion/`
9. ✅ `facProcessor.ts` → Migrado a `apps/electron/src/modules/facturacion/`
10. ✅ `facWatcher.ts` → Migrado a `apps/electron/src/modules/facturacion/`
11. ✅ `remitoProcessor.ts` → Migrado a `apps/electron/src/modules/facturacion/`
12. ✅ `padron.ts` → Migrado a `apps/electron/src/modules/facturacion/`
13. ✅ `types.ts` → Migrado a `apps/electron/src/modules/facturacion/`

#### Carpetas completas en src/modules/facturacion/
14. ✅ `afip/` (12 archivos) → Migrado a `apps/electron/src/modules/facturacion/afip/`
15. ✅ `utils/` (2 archivos) → Migrado a `apps/electron/src/modules/facturacion/utils/`
16. ✅ `adapters/` (1 archivo) → Migrado a `apps/electron/src/modules/facturacion/adapters/`
17. ✅ `provincia/` (3 archivos) → Migrado a `apps/electron/src/modules/facturacion/provincia/`
18. ✅ `arca/` (2 archivos) → Migrado a `apps/electron/src/modules/facturacion/arca/`

#### Módulos en src/modules/perfiles/
19. ✅ `PerfilService.ts` → Migrado a `apps/electron/src/modules/perfiles/`
20. ✅ `types.ts` → Migrado a `apps/electron/src/modules/perfiles/`

#### Módulos en src/modules/retenciones/
21. ✅ `retencionProcessor.ts` → Migrado a `apps/electron/src/modules/retenciones/`
22. ✅ `retencionRenderer.ts` → Migrado a `apps/electron/src/modules/retenciones/`

#### Archivos raíz duplicados
23. ✅ `invoiceLayout.mendoza.ts` → Migrado a `apps/electron/src/`
24. ✅ `pdfRenderer.ts` → Migrado a `apps/electron/src/`

---

### ⚠️ Archivos LEGACY CON SHIMS (mantener solo shims)

Estos archivos tienen versión `.shim.ts` que apunta a `@infra`:

#### En src/services/ (eliminar .ts, mantener .shim.ts)
- `AfipService.ts` → Mantener solo `AfipService.shim.ts` (apunta a `@infra/afip`)
- `DbService.ts` → Mantener solo `DbService.shim.ts` (apunta a `@infra/database`)
- `LogService.ts` → Mantener solo `LogService.shim.ts` (apunta a `@infra/logger`)
- `EmailService.ts` → Mantener solo `EmailService.shim.ts` (apunta a `@infra/email`)
- `FtpService.ts` → Mantener solo `FtpService.shim.ts` (apunta a `@infra/ftp`)
- `FtpServerService.ts` → Mantener solo `FtpServerService.shim.ts`
- `MercadoPagoService.ts` → Mantener solo `MercadoPagoService.shim.ts`
- `BnaService.ts` → Mantener solo `BnaService.shim.ts`
- `GaliciaService.ts` → Mantener solo `GaliciaService.shim.ts`
- `SecureStore.ts` → Mantener solo `SecureStore.shim.ts`
- `PrintService.ts` → Mantener solo `PrintService.shim.ts`
- `A13FilesService.ts` → Mantener solo `A13FilesService.shim.ts`
- `AuthService.ts` → Mantener solo `AuthService.shim.ts`
- `OtpService.ts` → Mantener solo `OtpService.shim.ts`
- `queue/QueueDB.ts` → Mantener solo `queue/QueueDB.shim.ts`
- `queue/SqliteQueueStore.ts` → Mantener solo `queue/SqliteQueueStore.shim.ts`

---

### 🟢 Archivos QUE DEBEN PERMANECER (por ahora)

#### Entry points de Electron (críticos)
- `src/main.ts` - Entry point principal de Electron
- `src/preload.ts` - Preload script de Electron

#### Ventanas de UI (migrar en siguiente fase)
- `src/auth.ts` - Ventana de autenticación
- `src/caja.ts` - Ventana de caja
- `src/imagen.ts` - Ventana de modo imagen
- `src/calibrate.ts` - Utilidad de calibración

#### Módulos específicos (mantener)
- `src/contingency/` - Sistema de contingencia
- `src/main/bootstrap/` - Bootstrap de aplicación
- `src/afip/AFIPBridge.ts` - Bridge AFIP
- `src/libs/afip/` - SDK AFIP local
- `src/ws/` - WebSocket services
- `src/utils/` - Utilidades compartidas (con shims)
- `src/renderer.ts` - Renderer process
- `src/renderExample.ts` - Ejemplo de renderizado

#### Tests (mantener)
- `src/modules/facturacion/__tests__/` - Tests de facturación

#### Assets (mantener)
- `src/modules/fonts/` - Fuentes para PDFs
- `src/modules/facturacion/plantilla/` - Plantillas de imágenes

---

## 📦 Plan de Ejecución (3 Iteraciones)

### Iteración 1: Limpiar Servicios Duplicados (~30 min)
**Archivos a eliminar**: 6 servicios en `src/services/`
- CajaLogService.ts, CajaLogStore.ts
- ErrorNotificationService.ts
- FacturacionService.ts, FacturaGenerator.ts
- ReportService.ts

### Iteración 2: Limpiar Módulos de Facturación (~45 min)
**Archivos a eliminar**: ~30 archivos en `src/modules/facturacion/`
- Archivos raíz (afipService.ts, cotizacionHelper.ts, etc.)
- Carpetas completas (afip/, utils/, adapters/, provincia/, arca/)

### Iteración 3: Limpiar Módulos Perfiles/Retenciones + Archivos Raíz (~30 min)
**Archivos a eliminar**: ~8 archivos
- src/modules/perfiles/*
- src/modules/retenciones/*
- src/invoiceLayout.mendoza.ts
- src/pdfRenderer.ts

---

## ✅ Validaciones Post-Cleanup

Después de cada iteración:
1. ✅ `pnpm build:ts` - Sin errores
2. ✅ `pnpm start` - Electron arranca
3. ✅ Validar que shims siguen funcionando

---

## 📊 Estimación de Archivos

| Categoría | A Eliminar | A Mantener | Total |
|-----------|------------|------------|-------|
| Servicios duplicados | 6 | 0 | 6 |
| Servicios legacy | 16 (.ts) | 16 (.shim.ts) | 32 |
| Módulos facturación | ~30 | 0 | 30 |
| Módulos perfiles/retenciones | 4 | 0 | 4 |
| Archivos raíz duplicados | 2 | 0 | 2 |
| Entry points | 0 | 2 | 2 |
| UI Windows | 0 | 4 | 4 |
| Tests | 0 | ~20 | 20 |
| Assets | 0 | ~10 | 10 |
| **TOTAL** | **~58** | **~52** | **110** |

---

**Tiempo estimado total**: 2-3 horas  
**Fecha**: 14 de Octubre, 2025

