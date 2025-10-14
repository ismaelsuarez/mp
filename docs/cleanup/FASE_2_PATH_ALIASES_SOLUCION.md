# 🔧 Solución: Path Aliases en Electron Runtime

## 📋 Problema Identificado

**Error**: `Cannot find module '@shared/constants/licencia'`

TypeScript compilaba correctamente con path aliases (`@shared/*`, `@core/*`, `@infra/*`), pero **Electron/Node.js no podía resolver estos aliases en runtime** porque:

1. Los path aliases son una feature de TypeScript para **desarrollo**
2. El código compilado (JavaScript) mantiene los imports con aliases
3. Node.js/Electron **no entiende** estos aliases personalizados

## ✅ Solución Implementada

### Herramienta: `tsc-alias`

`tsc-alias` transforma los path aliases a rutas relativas **después de la compilación**:

```bash
pnpm add -D -w tsc-alias
```

### Configuración

**`package.json`**:
```json
{
  "scripts": {
    "build:ts": "tsc -p tsconfig.json && tsc-alias -p tsconfig.json"
  }
}
```

### Transformación Aplicada

**Antes (TypeScript source)**:
```typescript
import { HMAC_MASTER_SECRET } from '@shared/constants/licencia';
import { computeSerial } from '@core/licencia/validators';
```

**Después (JavaScript compilado)**:
```javascript
const licencia_1 = require("../../packages/shared/src/constants/licencia");
const validators_1 = require("../../packages/core/src/licencia/validators");
```

## 🎯 Resultado

✅ **Path aliases funcionan correctamente en runtime**  
✅ **Electron arranca sin errores de módulos**  
✅ **Código de salida: 0 (exitoso)**  
✅ **Build exitoso: 0 errores TypeScript**

## 📝 Notas Técnicas

### Alternativas Consideradas (NO funcionan)

1. ❌ **`tsconfig-paths/register`**: Solo funciona para código TypeScript ejecutado con `ts-node`, NO para JavaScript compilado ejecutado por Electron
2. ❌ **Module alias en runtime**: Requiere modificar el loader de Node.js, complica el proceso

### Por Qué `tsc-alias` es la Mejor Solución

1. ✅ Transforma paths en **build time**, no runtime
2. ✅ Zero overhead en runtime
3. ✅ Compatible con cualquier runtime (Electron, Node.js, web)
4. ✅ No requiere configuración adicional en runtime
5. ✅ Mantiene la DX de path aliases en desarrollo

## 🔍 Verificación

```bash
# Compilar
pnpm build:ts

# Verificar transformación
cat dist/src/utils/licencia.js | grep "require.*packages"
# Debe mostrar rutas relativas como: ../../packages/shared/src/...

# Ejecutar Electron
pnpm start
# Debe arrancar sin errores de "Cannot find module"
```

## 🚀 Estado Final

- **Fase 2 completada al 100%**
- **115+ exports migrados a @shared y @core**
- **Path aliases funcionando en desarrollo Y producción**
- **Build pipeline actualizado con tsc-alias**
- **Aplicación Electron funcional**

---

**Fecha**: 14 de Octubre, 2025  
**Branch**: `refactor/migrate-to-packages`  
**Issue**: Path aliases runtime resolution

