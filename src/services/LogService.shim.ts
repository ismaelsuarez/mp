/**
 * @deprecated Use @infra/logger instead
 * 
 * Este archivo es un shim temporal para mantener compatibilidad hacia atrás.
 * TODO(phase-8): Remover este shim y actualizar todos los imports a @infra/logger
 * 
 * Migration path:
 * ```typescript
 * // Viejo (deprecated)
 * import { logInfo, logError } from './services/LogService';
 * 
 * // Nuevo (recomendado)
 * import { logInfo, logError } from '@infra/logger';
 * ```
 */

export * from '@infra/logger';

