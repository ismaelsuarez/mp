/**
 * @deprecated Use @infra/database/queue instead
 * 
 * Este archivo es un shim temporal para mantener compatibilidad hacia atrás.
 * TODO(phase-8): Remover este shim y actualizar todos los imports a @infra/database/queue
 * 
 * Migration path:
 * ```typescript
 * // Viejo (deprecated)
 * import { getQueueStore } from './services/queue/SqliteQueueStore';
 * 
 * // Nuevo (recomendado)
 * import { getQueueStore } from '@infra/database/queue';
 * ```
 */

export * from '@infra/database/queue/SqliteQueueStore';

