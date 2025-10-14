# ⚠️ FASE 4: PROBLEMA DETECTADO Y NUEVA ESTRATEGIA

## 🔍 Análisis del Problema

Al intentar eliminar archivos duplicados de `src/`, encontramos que hay **muchas referencias cruzadas** que requieren actualización manual:

### Archivos con Referencias a Código Eliminado

1. **`apps/electron/src/modules/facturacion/facProcessor.ts`**
   - ❌ `import from '../../../../../src/pdfRenderer'`
   - ❌ `import from '../../../../../src/invoiceLayout.mendoza'`
   - ❌ `import from '../../../../../src/modules/facturacion/utils/TimeValidator'`

2. **`apps/electron/src/services/FacturacionService.ts`**
   - ❌ `import from '../../../../src/modules/facturacion/afipService'`
   - ❌ `import from '../../../../src/modules/facturacion/types'`
   - ❌ `import from '../../../../src/modules/facturacion/provincia/IProvinciaService'`
   - ❌ `import from '../../../../src/pdfRenderer'`

3. **`src/main.ts`**, **`src/calibrate.ts`**, **`src/renderExample.ts`**
   - ❌ Múltiples imports de `src/modules/` y `src/pdfRenderer`

4. **`src/services/AfipService.ts`**
   - ❌ `import from '../modules/facturacion/adapters/CompatAfip'`

5. **`tests/pipeline.unit.spec.ts`**
   - ❌ `import from '../src/modules/facturacion/afip/helpers'`

---

## 💡 Nueva Estrategia: ROLLBACK PARCIAL

### Decisión

**No podemos eliminar los archivos de `src/` todavía** porque:
1. Hay demasiadas referencias cruzadas entre `apps/electron/src/` y `src/`
2. Los archivos en `apps/electron/src/` aún apuntan a `src/` en algunos casos
3. Actualizar todas las referencias manualmente tomaría mucho tiempo y es propenso a errores

### Plan Revisado

#### Fase 4A: Restaurar Archivos Eliminados (NOW)
1. ✅ Restaurar archivos eliminados de `src/modules/`
2. ✅ Mantener build funcional
3. ✅ Validar que Electron arranca

#### Fase 4B: Actualizar Referencias Gradualmente (NEXT)
1. Actualizar imports en `apps/electron/src/` para usar rutas relativas locales
2. Actualizar imports en `src/` para usar `@electron/*` alias
3. Eliminar archivos duplicados gradualmente por módulo

#### Fase 4C: Cleanup Final (LATER)
1. Una vez que todas las referencias estén actualizadas
2. Eliminar archivos duplicados de `src/`
3. Mantener solo entry points y código legacy necesario

---

## 🔄 Rollback Inmediato

### Archivos a Restaurar

```bash
# Módulos de facturación
src/modules/facturacion/afipService.ts
src/modules/facturacion/cotizacionHelper.ts
src/modules/facturacion/facProcessor.ts
src/modules/facturacion/facWatcher.ts
src/modules/facturacion/remitoProcessor.ts
src/modules/facturacion/padron.ts
src/modules/facturacion/types.ts

# Carpetas completas
src/modules/facturacion/afip/
src/modules/facturacion/utils/
src/modules/facturacion/adapters/
src/modules/facturacion/provincia/
src/modules/facturacion/arca/

# Perfiles y retenciones
src/modules/perfiles/PerfilService.ts
src/modules/perfiles/types.ts
src/modules/retenciones/retencionProcessor.ts
src/modules/retenciones/retencionRenderer.ts

# Archivos raíz
src/invoiceLayout.mendoza.ts
src/pdfRenderer.ts
```

---

## 📝 Lecciones Aprendidas

1. **No se debe eliminar código hasta que todas las referencias estén actualizadas**
2. **La fase de "migración" debe estar completa antes de "cleanup"**
3. **Necesitamos un path alias `@electron/*` para evitar imports relativos largos**

---

## 🎯 Plan Corregido para Fase 4

### Iteración 1: Configurar Alias `@electron/*`
- Agregar `"@electron/*": ["apps/electron/src/*"]` a `tsconfig.json`
- Actualizar `vitest.config.ts` con el nuevo alias

### Iteración 2: Actualizar Imports en `apps/electron/src/`
- Cambiar todos los imports de `../../../../../src/` a rutas relativas o `@electron/*`
- Validar build después de cada cambio

### Iteración 3: Actualizar Imports en `src/`
- Cambiar todos los imports de `./modules/` a `@electron/modules/`
- Cambiar todos los imports de `./services/` a `@electron/services/`

### Iteración 4: Eliminar Duplicados Gradualmente
- Eliminar un módulo a la vez
- Validar build después de cada eliminación
- Si algo falla, restaurar inmediatamente

---

**Tiempo estimado revisado**: 4-5 horas (en vez de 2-3)  
**Estado actual**: ROLLBACK NECESARIO  
**Próxima acción**: Restaurar archivos y replantear estrategia

---

**Fecha**: 14 de Octubre, 2025  
**Generado por**: Cursor AI Agent

