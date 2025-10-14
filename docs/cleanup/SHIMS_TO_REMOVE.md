# 📋 Inventario de Shims (Backward Compatibility)

**Fecha**: 14 de Octubre, 2025  
**Estado**: Fase 2 completada - **13 shims activos**

---

## 🎯 Propósito

Los shims permiten migración gradual sin breaking changes. Todos los imports originales siguen funcionando vía re-exports desde `@shared`, `@core`, o `@infra`.

**⚠️ Importante**: Estos archivos deben removerse en **Fase 8** después de actualizar todos los imports a los nuevos paths.

---

## 📦 Shims de Fase 2.1 (@shared)

### Tipos
| Shim Original | Redirige a | Comando para buscar usages |
|---------------|------------|----------------------------|
| `src/modules/facturacion/types.ts` | `@shared/types` | `grep -r "from.*modules/facturacion/types" src/` |
| `src/modules/facturacion/afip/types.ts` | `@shared/types` | `grep -r "from.*facturacion/afip/types" src/` |
| `src/modules/perfiles/types.ts` | `@shared/types` | `grep -r "from.*perfiles/types" src/` |

### Utilidades
| Shim Original | Redirige a | Comando para buscar usages |
|---------------|------------|----------------------------|
| `src/utils/config.ts` | `@shared/utils` | `grep -r "from.*utils/config" src/` |

---

## 📦 Shims de Fase 2.2 (@core)

### Helpers AFIP
| Shim Original | Redirige a | Comando para buscar usages |
|---------------|------------|----------------------------|
| `src/modules/facturacion/afip/helpers.ts` | `@core/afip` | `grep -r "from.*facturacion/afip/helpers" src/` |

### Validadores Licencia
| Shim Original | Redirige a | Comando para buscar usages |
|---------------|------------|----------------------------|
| `src/utils/licencia.ts` | `@core/licencia` | `grep -r "from.*utils/licencia" src/` |

---

## 📦 Shims de Fase 2.3 (@infra)

### Database Services
| Shim Original | Redirige a | Comando para buscar usages |
|---------------|------------|----------------------------|
| `src/services/DbService.shim.ts` | `@infra/database` | `grep -r "from.*services/DbService" src/` |
| `src/services/queue/QueueDB.shim.ts` | `@infra/database/queue` | `grep -r "from.*queue/QueueDB" src/` |
| `src/services/queue/SqliteQueueStore.shim.ts` | `@infra/database/queue` | `grep -r "from.*queue/SqliteQueueStore" src/` |

### Logger
| Shim Original | Redirige a | Comando para buscar usages |
|---------------|------------|----------------------------|
| `src/services/LogService.shim.ts` | `@infra/logger` | `grep -r "from.*services/LogService" src/` |

### HTTP Clients
| Shim Original | Redirige a | Comando para buscar usages |
|---------------|------------|----------------------------|
| `src/services/AfipService.shim.ts` | `@infra/afip` | `grep -r "from.*services/AfipService" src/` |
| `src/services/MercadoPagoService.shim.ts` | `@infra/mercadopago` | `grep -r "from.*services/MercadoPagoService" src/` |
| `src/services/BnaService.shim.ts` | `@infra/bna` | `grep -r "from.*services/BnaService" src/` |
| `src/services/GaliciaService.shim.ts` | `@infra/galicia` | `grep -r "from.*services/GaliciaService" src/` |

### Communication
| Shim Original | Redirige a | Comando para buscar usages |
|---------------|------------|----------------------------|
| `src/services/EmailService.shim.ts` | `@infra/email` | `grep -r "from.*services/EmailService" src/` |
| `src/services/FtpService.shim.ts` | `@infra/ftp` | `grep -r "from.*services/FtpService" src/` |
| `src/services/FtpServerService.shim.ts` | `@infra/ftp` | `grep -r "from.*services/FtpServerService" src/` |

### Storage, Printing, Filesystem, Auth
| Shim Original | Redirige a | Comando para buscar usages |
|---------------|------------|----------------------------|
| `src/services/SecureStore.shim.ts` | `@infra/storage` | `grep -r "from.*services/SecureStore" src/` |
| `src/services/PrintService.shim.ts` | `@infra/printing` | `grep -r "from.*services/PrintService" src/` |
| `src/services/A13FilesService.shim.ts` | `@infra/filesystem` | `grep -r "from.*services/A13FilesService" src/` |
| `src/services/AuthService.shim.ts` | `@infra/auth` | `grep -r "from.*services/AuthService" src/` |
| `src/services/OtpService.shim.ts` | `@infra/auth` | `grep -r "from.*services/OtpService" src/` |

---

## 📊 Resumen por Categoría

| Categoría | Shims | Estado |
|-----------|-------|--------|
| **@shared (tipos)** | 3 | ✅ Fase 2.1 |
| **@shared (utils)** | 1 | ✅ Fase 2.1 |
| **@core (afip)** | 1 | ✅ Fase 2.2 |
| **@core (licencia)** | 1 | ✅ Fase 2.2 |
| **@infra (database)** | 3 | ✅ Fase 2.3 |
| **@infra (logger)** | 1 | ✅ Fase 2.3 |
| **@infra (http)** | 4 | ✅ Fase 2.3 |
| **@infra (comm)** | 3 | ✅ Fase 2.3 |
| **@infra (storage/auth)** | 5 | ✅ Fase 2.3 |
| **TOTAL** | **22** | ✅ |

---

## 🔄 Proceso de Remoción (Fase 8)

### 1. Buscar usages
Para cada shim, ejecutar el comando grep correspondiente para encontrar todos los imports que lo usan.

### 2. Actualizar imports
Reemplazar todos los imports al shim con imports directos al nuevo path:

```typescript
// ❌ Viejo (via shim)
import { getDb } from './services/DbService';

// ✅ Nuevo (directo)
import { getDb } from '@infra/database';
```

### 3. Verificar build y tests
```bash
pnpm build:ts
pnpm test
```

### 4. Remover shim
Una vez que todos los imports se actualizaron y las pruebas pasan:
```bash
rm src/services/DbService.shim.ts
```

### 5. Commit incremental
Commit por cada shim removido para facilitar debug si algo falla.

---

## ⚠️ Dependencias entre Shims

### Orden de remoción recomendado:

1. **@shared** (base, sin dependencias)
2. **@core** (puede depender de @shared)
3. **@infra** (puede depender de @core y @shared)

### Dentro de @infra:
1. Logger (base, pocos dependientes)
2. Database (usado por muchos)
3. Storage, Auth (dependencias internas)
4. HTTP Clients (dependencias externas)
5. Communication, Filesystem (último nivel)

---

## 📝 Checklist de Remoción

- [ ] Completar Fase 3-7 (migración completa)
- [ ] Buscar y actualizar todos los imports a @shared
- [ ] Remover shims de @shared
- [ ] Buscar y actualizar todos los imports a @core
- [ ] Remover shims de @core
- [ ] Buscar y actualizar todos los imports a @infra
- [ ] Remover shims de @infra
- [ ] Verificar build final sin shims
- [ ] Smoke tests completos
- [ ] Commit final: "chore: remove all migration shims"

---

**Estado actual**: ✅ Todos los shims funcionando  
**Siguiente paso**: Continuar con Fase 3, remover shims en Fase 8
