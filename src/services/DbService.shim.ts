/**
 * @deprecated Use @infra/database instead
 * 
 * Este archivo es un shim temporal para mantener compatibilidad hacia atrás.
 * TODO(phase-8): Remover este shim y actualizar todos los imports a @infra/database
 * 
 * Migration path:
 * ```typescript
 * // Viejo (deprecated)
 * import { getDb } from './services/DbService';
 * 
 * // Nuevo (recomendado)
 * import { getDb } from '@infra/database';
 * ```
 */

export * from '@infra/database/DbService';

