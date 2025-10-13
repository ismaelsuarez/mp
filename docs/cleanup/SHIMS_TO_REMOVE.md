# Shims a Remover en Fase 8

**Fecha creación**: Octubre 2025  
**Estado**: Documentación de shims creados durante Fase 2

## Qué son los Shims

Los **shims** son archivos que re-exportan código desde las nuevas ubicaciones en `packages/` para mantener compatibilidad con código existente que importa desde las ubicaciones antiguas en `src/`.

**Propósito**:
- Permitir migración gradual sin romper código
- Código nuevo puede usar imports de `@shared/@core/@infra`
- Código viejo sigue funcionando via shims

**Eliminación**: Fase 8 (después de actualizar todos los imports)

---

## Shims Creados

### Tipos (@shared/types)

#### 1. src/modules/facturacion/types.ts
- **Creado**: Fase 2, Iteración 1
- **Re-exporta desde**: `@shared/types/facturacion`
- **Tipos exportados**: ~31 (Factura, Empresa, Cliente, Comprobante, etc.)
- **Comando para buscar usos**:
  ```bash
  grep -r "from.*modules/facturacion/types" src/ --exclude-dir=node_modules
  ```

#### 2. src/modules/facturacion/afip/types.ts
- **Creado**: Fase 2, Iteración 1
- **Re-exporta desde**: `@shared/types/afip`
- **Tipos exportados**: ~21 + 5 enums (AfipVoucherResponse, CbteTipo, DocTipo, etc.)
- **Comando para buscar usos**:
  ```bash
  grep -r "from.*facturacion/afip/types" src/ --exclude-dir=node_modules
  ```

#### 3. src/modules/perfiles/types.ts
- **Creado**: Fase 2, Iteración 1
- **Re-exporta desde**: `@shared/types/perfiles`
- **Tipos exportados**: 3 (Perfil, PerfilPermisos, PerfilParametros)
- **Comando para buscar usos**:
  ```bash
  grep -r "from.*perfiles/types" src/ --exclude-dir=node_modules
  ```

### Helpers (@core/afip)

#### 4. src/modules/facturacion/afip/helpers.ts
- **Creado**: Fase 2, Iteración 2 y 3
- **Re-exporta desde**: `@core/afip/helpers`, `@core/afip/calculators`, `@core/afip/validators`
- **Tipo**: Shim parcial (mantiene AfipHelpers class pero usa core helpers)
- **Funciones migradas** (Iteración 2): mapTipoCbte, mapClaseYTipoACbteTipo, monthStartFromYYYYMMDD
- **Funciones migradas** (Iteración 3): buildIvaArray, consolidateTotals, buildQrUrl, validateComprobante, formatNumber
- **Comando para buscar usos**:
  ```bash
  grep -r "from.*afip/helpers" src/ --exclude-dir=node_modules
  ```

### Constantes (@shared/constants)

#### 5. src/utils/config.ts
- **Creado**: Fase 2, Iteración 3
- **Re-exporta desde**: `@shared/constants/licencia`
- **Constantes exportadas**: 2 (HMAC_MASTER_SECRET, LICENSE_ENCRYPTION_KEY)
- **Comando para buscar usos**:
  ```bash
  grep -r "from.*utils/config" src/ --exclude-dir=node_modules
  ```

### Validators (@core/licencia)

#### 6. src/utils/licencia.ts
- **Creado**: Fase 2, Iteración 3
- **Re-exporta desde**: `@core/licencia/validators`, `@shared/constants/licencia`
- **Tipo**: Shim parcial (mantiene funciones de infra, delega validadores puros a core)
- **Funciones migradas**: validarSerial, computeSerial
- **Funciones de infra**: guardarLicencia, cargarLicencia, recuperarSerial (no migradas aún)
- **Comando para buscar usos**:
  ```bash
  grep -r "from.*utils/licencia" src/ --exclude-dir=node_modules
  ```

---

## Estadísticas

| Tipo | Cantidad | Ubicación Original | Nueva Ubicación |
|------|----------|-------------------|-----------------|
| Tipos de facturación | 31 | src/modules/facturacion/types.ts | @shared/types/facturacion |
| Tipos AFIP | 21 + 5 enums | src/modules/facturacion/afip/types.ts | @shared/types/afip |
| Tipos perfiles | 3 | src/modules/perfiles/types.ts | @shared/types/perfiles |
| Tipos time | 4 interfaces | N/A (nuevos) | @shared/types/time |
| Constantes AFIP | 3 mapeos | N/A (extraídos) | @shared/constants/afip |
| Constantes licencia | 2 | src/utils/config.ts | @shared/constants/licencia |
| Helpers AFIP | 10 funciones | src/modules/facturacion/afip/helpers.ts | @core/afip/helpers |
| Calculators AFIP | 5 funciones | src/modules/facturacion/afip/helpers.ts | @core/afip/calculators |
| Validators AFIP | 4 funciones | src/modules/facturacion/afip/helpers.ts | @core/afip/validators |
| Validators licencia | 3 funciones | src/utils/licencia.ts | @core/licencia/validators |

**Total de shims**: 6 archivos  
**Total de exports migrados**: ~80+ tipos/funciones/constantes

---

## Plan de Eliminación (Fase 8)

### Paso 1: Actualizar Imports
Buscar y reemplazar todos los imports que usan rutas relativas por imports de packages:

```bash
# Ejemplo: Actualizar imports de tipos de facturación
find src/ -name "*.ts" -exec sed -i "s|from ['\"].*modules/facturacion/types['\"]|from '@shared/types/facturacion'|g" {} \;
```

### Paso 2: Verificar Build
```bash
pnpm build:ts
```

### Paso 3: Ejecutar Tests
```bash
pnpm test
```

### Paso 4: Eliminar Shims
Una vez que no haya imports a las ubicaciones viejas:
```bash
# Verificar que no hay imports
grep -r "from.*modules/facturacion/types" src/ --exclude-dir=node_modules

# Si no hay resultados, eliminar shim
rm src/modules/facturacion/types.ts
```

### Paso 5: Repetir para cada Shim
Hacer lo mismo para:
- `src/modules/facturacion/afip/types.ts`
- `src/modules/perfiles/types.ts`
- `src/modules/facturacion/afip/helpers.ts`
- `src/utils/config.ts`
- `src/utils/licencia.ts`

---

## Verificación de Dependencias

### Comando para Listar Imports Viejos
```bash
# Buscar todos los imports que usan rutas relativas a módulos
grep -rn "from ['\"]\.\..*modules" src/ --include="*.ts" | grep -v "node_modules"
```

### Comando para Listar Imports Nuevos (@shared/@core/@infra)
```bash
# Verificar uso de nuevos imports
grep -rn "from ['\"]@\(shared\|core\|infra\)" src/ --include="*.ts"
```

---

## Estrategia de Actualización Progresiva

### Opción A: Big Bang (Fase 8)
- Actualizar todos los imports a la vez
- Ejecutar script de búsqueda y reemplazo
- Eliminar todos los shims de una vez
- **Ventaja**: Limpieza rápida
- **Desventaja**: Alto riesgo si algo falla

### Opción B: Gradual (Recomendada)
- Actualizar imports por módulo/dominio
- Verificar tests después de cada módulo
- Eliminar shims uno por uno
- **Ventaja**: Bajo riesgo, fácil rollback
- **Desventaja**: Toma más tiempo

---

## Notas Importantes

### Compatibilidad
- ✅ Código viejo sigue funcionando via shims
- ✅ Código nuevo puede usar imports de packages
- ✅ Build compila sin errores
- ✅ Tests pasan sin cambios

### Testing
- Los shims permiten ejecutar tests existentes sin cambios
- Tests nuevos deben usar imports de packages
- Coverage se mantiene igual

### Build Time
- Los shims no degradan build time
- Path aliases resuelven eficientemente
- No hay overhead en runtime

---

## Checklist Pre-Eliminación (Fase 8)

Antes de eliminar shims, verificar:

- [ ] Buscar imports viejos: `grep -r "from.*modules/facturacion/types" src/`
- [ ] No hay resultados (todos actualizados)
- [ ] Build compila: `pnpm build:ts`
- [ ] Tests pasan: `pnpm test`
- [ ] Coverage mantiene ≥80%
- [ ] Smoke tests manuales OK
- [ ] Documentar cambios en CHANGELOG

Solo después de ✅ todos los items, eliminar shims.

---

**Última actualización**: Octubre 2025  
**Responsable**: Equipo de desarrollo  
**Próxima revisión**: Fase 8 (build config profesional)

