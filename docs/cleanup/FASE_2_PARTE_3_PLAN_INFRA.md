# 📋 Fase 2 - Parte 3: Migración a @infra

## 🎯 Objetivo

Migrar adaptadores e integraciones de plataforma desde `src/services/` a `packages/infra/src/`.

## 📦 Servicios Identificados

### Categoría 1: Integraciones Externas (Prioridad Alta)

| Servicio | Descripción | Destino |
|----------|-------------|---------|
| `AfipService.ts` | Integración AFIP (WSFE, cotización) | `@infra/afip/` |
| `MercadoPagoService.ts` | Cliente HTTP MercadoPago | `@infra/mercadopago/` |
| `BnaService.ts` | Consulta cotización BNA | `@infra/bna/` |
| `GaliciaService.ts` | Integración Banco Galicia | `@infra/galicia/` |

### Categoría 2: Persistencia (Prioridad Alta)

| Servicio | Descripción | Destino |
|----------|-------------|---------|
| `DbService.ts` | Better-sqlite3 wrapper | `@infra/database/DbService.ts` |
| `SecureStore.ts` | Almacenamiento seguro (keytar + electron-store) | `@infra/storage/SecureStore.ts` |
| `CajaLogStore.ts` | SQLite logs de caja | `@infra/database/CajaLogStore.ts` |
| `queue/QueueDB.ts` | Cola SQLite | `@infra/database/queue/` |

### Categoría 3: Comunicación (Prioridad Media)

| Servicio | Descripción | Destino |
|----------|-------------|---------|
| `EmailService.ts` | Nodemailer wrapper | `@infra/email/` |
| `FtpService.ts` | Cliente FTP | `@infra/ftp/FtpClient.ts` |
| `FtpServerService.ts` | Servidor FTP | `@infra/ftp/FtpServer.ts` |

### Categoría 4: Sistema (Prioridad Media)

| Servicio | Descripción | Destino |
|----------|-------------|---------|
| `LogService.ts` | Winston logger | `@infra/logger/` |
| `PrintService.ts` | Impresión PDFs | `@infra/printing/` |
| `A13FilesService.ts` | Gestión archivos A13 | `@infra/filesystem/` |

### Categoría 5: Auth & Seguridad (Prioridad Baja)

| Servicio | Descripción | Destino |
|----------|-------------|---------|
| `AuthService.ts` | Autenticación | `@infra/auth/` |
| `OtpService.ts` | OTP generation | `@infra/auth/` |

### Categoría 6: Orquestación (NO migrar a @infra)

| Servicio | Descripción | Destino |
|----------|-------------|---------|
| `FacturacionService.ts` | Orquestador facturación | Mantener en `src/services/` (usa @core + @infra) |
| `FacturaGenerator.ts` | Generador facturas | `@core/facturacion/` (lógica pura) |
| `ReportService.ts` | Generación reportes | `@core/reporting/` (lógica pura) |
| `ErrorNotificationService.ts` | Gestión errores | Mantener en `src/services/` |
| `CajaLogService.ts` | Servicio logs caja | Mantener en `src/services/` (usa @infra) |

### Categoría 7: AFIP Helpers (NO migrar, ya en @core)

| Servicio | Descripción | Estado |
|----------|-------------|--------|
| `afip/wsfe/builders.ts` | Builders WSFE | Revisar si va a `@core/afip/` |
| `afip/wsfe/catalogs.ts` | Catálogos AFIP | Mover a `@shared/constants/afip` |
| `afip/AfipEndpoints.ts` | URLs AFIP | Mover a `@shared/constants/afip` |

---

## 📐 Estrategia de Migración

### Iteración 1: Persistencia (Base crítica)
1. ✅ Crear `@infra/database/`
2. ✅ Migrar `DbService`
3. ✅ Migrar `QueueDB` y `SqliteQueueStore`
4. ✅ Crear shims
5. ✅ Verificar build

### Iteración 2: Logger (Usado por todos)
1. ✅ Crear `@infra/logger/`
2. ✅ Migrar `LogService`
3. ✅ Crear shim
4. ✅ Verificar build

### Iteración 3: Integraciones HTTP
1. ✅ Crear `@infra/afip/`
2. ✅ Migrar `AfipService` (adaptador HTTP)
3. ✅ Crear `@infra/mercadopago/`
4. ✅ Migrar `MercadoPagoService`
5. ✅ Crear shims
6. ✅ Verificar build

### Iteración 4: Comunicación
1. ✅ Crear `@infra/email/`
2. ✅ Crear `@infra/ftp/`
3. ✅ Migrar servicios
4. ✅ Crear shims
5. ✅ Verificar build

### Iteración 5: Storage & Filesystem
1. ✅ Migrar `SecureStore`
2. ✅ Migrar `A13FilesService`
3. ✅ Migrar `PrintService`
4. ✅ Crear shims
5. ✅ Verificar build

---

## 🏗️ Estructura @infra Final

```
packages/infra/src/
├── database/
│   ├── DbService.ts          # Better-sqlite3 wrapper
│   ├── CajaLogStore.ts       # SQLite logs de caja
│   └── queue/
│       ├── QueueDB.ts
│       └── SqliteQueueStore.ts
├── logger/
│   ├── LogService.ts         # Winston wrapper
│   └── types.ts
├── afip/
│   ├── AfipClient.ts         # HTTP client AFIP
│   ├── wsfe/
│   │   ├── builders.ts
│   │   └── types.ts
│   └── types.ts
├── mercadopago/
│   └── MercadoPagoClient.ts
├── bna/
│   └── BnaClient.ts
├── galicia/
│   └── GaliciaClient.ts
├── email/
│   └── EmailService.ts       # Nodemailer wrapper
├── ftp/
│   ├── FtpClient.ts
│   └── FtpServer.ts
├── storage/
│   └── SecureStore.ts        # electron-store + keytar
├── filesystem/
│   └── A13FilesService.ts
├── printing/
│   └── PrintService.ts
├── auth/
│   ├── AuthService.ts
│   └── OtpService.ts
└── index.ts                  # Barrel export
```

---

## 📝 Principios de Migración

### ✅ Qué va a @infra
- Adaptadores de APIs externas (HTTP clients)
- Wrappers de librerías de terceros (sqlite, nodemailer, winston)
- Integraciones de plataforma (file system, printing, keytar)
- Lógica de comunicación (email, FTP)

### ❌ Qué NO va a @infra
- Orquestadores (servicios que coordinan @core + @infra)
- Lógica de negocio pura (va a @core)
- Tipos y constantes (va a @shared)

### 🔄 Patrón de Migración

1. **Identificar dependencias** del servicio
2. **Extraer lógica pura** a @core si existe
3. **Mover adaptador** a @infra
4. **Crear shim** en ubicación original
5. **Actualizar barrel exports**
6. **Verificar build + runtime**

---

## 🎯 Criterios de Aceptación

- [ ] 15+ servicios migrados a @infra
- [ ] Estructura @infra/database, logger, afip, email, ftp creada
- [ ] Shims funcionando para backward compatibility
- [ ] Build TypeScript sin errores
- [ ] Electron arranca correctamente
- [ ] Zero breaking changes

---

**Inicio**: Iteración 1 - Database Services

