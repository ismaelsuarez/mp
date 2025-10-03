### ContingencyController (cola .fac)

Rol
- Observa `FAC_INCOMING_DIR` y encola `.fac` estables (por tamaño) en `SqliteQueueStore`.
- Concurrency=1; FIFO por `available_at ASC, id ASC`.
- Mueve archivos: incoming → staging → processing → done/error, con borrado del `.fac` solo tras `RES_OK`.

Estados del pipeline (alto nivel)
- `NEW, ENQUEUED, PARSED, VALIDATED, WAIT_WS, SENDING_WS, WS_RETRY, WS_PAUSED, CAE_OK, PDF_OK, RES_OK, DONE, ERROR` (documentales; la DB usa `ENQUEUED|PROCESSING|RETRY|DONE|ERROR`).

Bootstrap
- `src/main/bootstrap/contingency.ts` inicializa rutas desde env:
  - `FAC_INCOMING_DIR, FAC_STAGING_DIR, FAC_PROCESSING_DIR, FAC_DONE_DIR, FAC_ERROR_DIR, FAC_OUT_DIR, FAC_MIN_STABLE_MS`.
- `app.whenReady()` → `bootstrapContingency()`; `before-quit` → `shutdownContingency()`.

Diagnóstico
- `npm run queue:inspect` para ver PRAGMAs/estado de `contingency.db`.


