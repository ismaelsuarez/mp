## Resumen ejecutivo

El proyecto usa SQLite exclusivamente vía `better-sqlite3` (v9.6.0) como base local embebida. La conexión es un singleton expuesto por `src/services/DbService.ts#getDb()`, que crea el archivo `facturas.db` en `app.getPath('userData')` (Windows: `%APPDATA%/Tc-Mp/...`). No se detectan ORMs ni migradores externos (Prisma/Knex/Drizzle/TypeORM). El esquema se inicializa en runtime con `CREATE TABLE IF NOT EXISTS ...` y se mantiene mediante SQL directo. No hay PRAGMAs explícitos en código, pero el inspector en runtime reporta: `journal_mode=delete`, `synchronous=2`, `foreign_keys=1`, `busy_timeout=5000`, `wal_autocheckpoint=1000`, `page_size=4096`, `locking_mode=normal`.

Recomendación: para una cola de contingencia (.fac jobs), usar una base separada `contingency.db` en una carpeta dedicada dentro de `userData`. Alternativamente, si se desea reusar la conexión actual, crear tablas namespaced con transacciones cortas y un `busy_timeout` explícito. Dado el acceso síncrono de `better-sqlite3`, el riesgo de contención es bajo, pero separar archivos aisla crecimiento y operaciones de mantenimiento (VACUUM) de los datos de facturas.

---

## Mapa de dependencias y puntos de conexión

| Componente | Versión | Uso | Rutas (imports/creates) |
|---|---:|---|---|
| better-sqlite3 | 9.6.0 | Driver SQLite síncrono | `src/services/DbService.ts` `require('better-sqlite3')`; creación: `new Database(dbPath)` |
| sqlite3 | — | No encontrado | — |
| Prisma (sqlite) | — | No encontrado | — |
| Knex | — | No encontrado | — |
| Drizzle ORM (sqlite) | — | No encontrado | — |
| TypeORM (sqlite) | — | No encontrado | — |
| Sequelize (sqlite) | — | No encontrado | — |
| Dexie/wa-sqlite | — | No encontrado | — |

Conexión: singleton `getDb()` en `src/services/DbService.ts`.

---

## Configuración y PRAGMAs

| Aspecto | Valor actual |
|---|---|
| Ruta archivo .db | `app.getPath('userData')/facturas.db` |
| Ubicación Windows | `%APPDATA%/Tc-Mp/facturas.db` (según `userData`) |
| En empaquetado | Usa `app.getPath('userData')` (válido en producción) |
| Variables .env | No específicas para DB detectadas |
| PRAGMAs aplicados | No explícitos en código; inspector reporta `journal_mode=delete`, `synchronous=2`, `foreign_keys=1`, `busy_timeout=5000`, `wal_autocheckpoint=1000`, `page_size=4096`, `locking_mode=normal` |
| busy_timeout | 5000 ms (reportado por inspector) |
| Modo journal | `delete` (no WAL) |

Fragmento de creación:
```68:81:src/services/DbService.ts
this.dbPath = path.join(userData, 'facturas.db');
Database = require('better-sqlite3');
this.db = new Database(this.dbPath);
this.enabled = true;
this.initSchema();
```

---

## Esquema y migraciones

No hay ORM ni migrador externo; el esquema se crea en `initSchema()` con `CREATE TABLE IF NOT EXISTS`:

```94:132:src/services/DbService.ts
CREATE TABLE IF NOT EXISTS configuracion_afip (...);
CREATE TABLE IF NOT EXISTS facturas_afip (...);
CREATE TABLE IF NOT EXISTS facturas_estado (...);
CREATE TABLE IF NOT EXISTS comprobantes_control (... UNIQUE(pto_vta, tipo_cbte, nro_comprobante));
CREATE TABLE IF NOT EXISTS empresa_config (...);
CREATE TABLE IF NOT EXISTS parametros_facturacion (...);
```

Política de migración: alteraciones puntuales inline (`ALTER TABLE parametros_facturacion ADD COLUMN ...`) para compatibilidad suave. No hay versionado de migraciones.

Tablas más relevantes (columnas clave):

| Tabla | Columnas principales |
|---|---|
| configuracion_afip | cuit, pto_vta, cert_path, key_path, entorno |
| facturas_afip | numero, pto_vta, tipo_cbte, fecha, cuit_emisor, totales, cae, cae_vencimiento, qr_url, pdf_path, campos provinciales |
| facturas_estado | numero, pto_vta, tipo_cbte, estado, error_msg, payload, created_at |
| comprobantes_control | pto_vta, tipo_cbte, nro_comprobante, estado (PENDING/APPROVED/FAILED), payload, updated_at |
| empresa_config | razon_social, cuit, domicilio, condicion_iva |
| parametros_facturacion | tipo_defecto, pto_vta, numeracion, es_mipyme_emisor, fce_umbral |

---

## Patrón de acceso y concurrencia

- Acceso: DAO minimalista en `DbService` con consultas crudas y `prepare().run()/get()/all()`.
- Concurrencia: `better-sqlite3` es síncrono; no hay workers/hilos que compartan conexión. Runtime actual: `journal_mode=delete`, `busy_timeout=5000`. No hay WAL habilitado; para una cola intensa se recomienda `WAL` + `synchronous=NORMAL` en una base separada.
- Transacciones: no se detectan `BEGIN/COMMIT` explícitos; operaciones unitarias por sentencia (rápidas). Riesgo de bloqueo bajo para una cola secuencial.

---

## Uso actual (funcional)

- Guarda configuración AFIP, facturas emitidas, estados/observaciones, perfiles y parámetros.
- Idempotencia/control: `comprobantes_control` previene duplicados por (pto_vta, tipo_cbte, nro_comprobante).
- Frecuencia: escrituras por emisión de comprobante y cambios de configuración. No hay cargas masivas.

---

## Riesgos de reutilización y opciones

Riesgos al reusar la misma base:
- Crecimiento del archivo por colas largas de `.fac` (histórico de jobs).
- Vacíos de mantenimiento (VACUUM) o copias de seguridad pueden impactar el tamaño de `facturas.db`.
- Potencial contención si se agregan transacciones largas (no previsto hoy).

Opciones:
1. Reusar `facturas.db` con tablas `contingency_*` (enqueue/ack/nack) y transacciones cortas.
   - Pros: una sola conexión/simplifica despliegue. 
   - Contras: crecimiento y riesgos de bloqueo compartidos con datos críticos de facturas.
2. Base separada `contingency.db` (misma carpeta `userData`).
   - Pros: aísla crecimiento, permite PRAGMAs específicos (WAL, busy_timeout), facilita backup/rotación.
   - Contras: segunda conexión/archivo.

Recomendación: opción 2 (base separada) para aislar la cola y habilitar PRAGMAs propios sin afectar facturas.

---

## Punto de enganche propuesto

- Punto único actual: `src/services/DbService.ts` + `getDb()`.
- Sugerencia: crear `src/services/QueueStore.ts` con interfaz mínima y adaptador SQLite (en PR futuro):

```ts
export interface QueueStore {
  enqueue(job: { type: string; payload: any }): number;
  getNext(types?: string[]): { id: number; type: string; payload: any } | null;
  ack(id: number): void;
  nack(id: number, reason?: string): void;
  requeue(id: number, delayMs?: number): void;
}
```

Ubicación sugerida: `src/services/queue/SqliteQueueStore.ts` (base `contingency.db`), usando una conexión propia (better-sqlite3) y PRAGMAs: `journal_mode=WAL`, `synchronous=NORMAL`, `busy_timeout=5000`, `foreign_keys=ON`.

---

## Matriz de compatibilidad

| Stack actual | ¿Compartir conexión para cola secuencial? | Comentario |
|---|---|---|
| better-sqlite3 | Posible | Es síncrono y estable; recomendable transacciones cortas y `busy_timeout`. Preferimos base separada para aislar tamaño y PRAGMAs. |
| sqlite3 (node-sqlite3) | — | No utilizado |
| Prisma/Knex/Drizzle/TypeORM | — | No utilizados |

Evidencia: imports/creates sólo en `DbService.ts`.

---

## Plan de PRs (sin romper lo existente)

- PR1: Infra cola SQLite separada
  - Archivos: `src/services/queue/SqliteQueueStore.ts`, `src/services/queue/index.ts`, `config/queue.config.json` (ruta base). 
  - Contenido: conexión `contingency.db` en `userData/queue/`, PRAGMAs (WAL, busy_timeout), tabla `queue_jobs` (id, type, payload, state, available_at, created_at, attempts, last_error).
  - Sin cambios en emisión actual; sólo módulo nuevo.

- PR2: Hook en `.fac` pipeline (opcional)
  - Archivos: `src/modules/facturacion/facProcessor.ts` (inyectar `QueueStore` a futuro). 
  - Contenido: si `QueueStore` está habilitado, encolar job y worker separado para procesar.
  - Mantener flujo actual por defecto.

- PR3: Observabilidad
  - Archivos: `scripts/queue-report.ts` para métricas; docs.
  - Contenido: conteo por estado, edad de jobs, tamaño `contingency.db`.

---

## Apéndice: resultados de búsquedas

Dependencia:
```114:118:package.json
"better-sqlite3": "^9.6.0"
```

Creación y uso:
```68:81:src/services/DbService.ts
this.dbPath = path.join(userData, 'facturas.db');
Database = require('better-sqlite3');
this.db = new Database(this.dbPath);
```

Reseteo y backups:
```1504:1507:src/main.ts
ipcMain.handle('db:reset', async () => { const res = getDb().resetDatabase(); ... });
```

Mensajes UI sobre backup sqlite:
```2393:2396:src/renderer.ts
Base reseteada. Backup sqlite: ...
```

No se hallaron otras bibliotecas SQLite.

Salida del inspector (ejemplo reciente):
```json
{
  "dbPath": "C:\\Users\\Ismael\\AppData\\Roaming\\Tc-Mp\\facturas.db",
  "exists": true,
  "sizeBytes": 45056,
  "walFile": null,
  "shmFile": null,
  "pragmas": {
    "journal_mode": "delete",
    "synchronous": 2,
    "foreign_keys": 1,
    "busy_timeout": 5000,
    "wal_autocheckpoint": 1000,
    "page_size": 4096,
    "locking_mode": "normal"
  }
}
```


