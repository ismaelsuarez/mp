/**
 * @infra/logger - Servicio de logging a archivos con redacción de secretos
 * 
 * Características:
 * - Logging a archivos diarios con rotación automática
 * - Categorías predefinidas (INFO, ERROR, SUCCESS, etc.)
 * - Redacción automática de secretos (tokens, passwords, keys)
 * - Log de errores separado
 * - Limpieza automática de logs antiguos (7 días)
 * - Búsqueda de errores recientes
 * - Resumen diario de logs
 */

export * from './LogService';

