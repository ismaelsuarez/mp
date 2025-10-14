/**
 * @deprecated Use @infra/afip instead
 * 
 * Este archivo es un shim temporal para mantener compatibilidad hacia atrás.
 * TODO(phase-8): Remover este shim y actualizar todos los imports a @infra/afip
 * 
 * Migration path:
 * ```typescript
 * // Viejo (deprecated)
 * import { getAfipService } from './services/AfipService';
 * 
 * // Nuevo (recomendado)
 * import { getAfipService } from '@infra/afip';
 * ```
 */

export * from '@infra/afip';

