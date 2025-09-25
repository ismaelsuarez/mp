### Cola de contingencia en SQLite (contingency.db)

Motivación
- Aislar la cola de jobs `.fac` de la base principal `facturas.db`.
- Aplicar PRAGMAs orientados a alto throughput y baja contención sin impactar facturas.

Ubicación
- Base: `app.getPath('userData')/queue/contingency.db`.

PRAGMAs aplicados (en orden)
- `foreign_keys=ON`
- `journal_mode=WAL`
- `synchronous=NORMAL`
- `busy_timeout=5000`
- `wal_autocheckpoint=1000`

Esquema
- `queue_jobs`: jobs con `state` (`NEW|ENQUEUED|PROCESSING|WS_PAUSED|RETRY|DONE|ERROR`), `available_at` para delay/requeue, `sha256` para idempotencia.
- `queue_audit`: auditoría de eventos por job.
- `queue_settings`: flags (ej.: `ws_circuit_state` UP/DOWN).

Adapter
- `SqliteQueueStore` implementa `enqueue`, `getNext`, `ack`, `nack`, `pause`, `resume`, `getStats`.
- FIFO por `available_at ASC, id ASC` con transición a `PROCESSING` atómica.

Inspección
- `npm run queue:inspect` imprime ruta, PRAGMAs, tamaño, `-wal`/`-shm`.


