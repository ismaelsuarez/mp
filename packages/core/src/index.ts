/**
 * @package core
 * @description Dominio puro: reglas de negocio, entidades, lógica AFIP/ARCA/MP
 *
 * Este paquete NO debe tener dependencias de infraestructura.
 * Solo lógica de negocio pura.
 */

// Exports
export * from './afip';
export * from './licencia';
export * from './facturacion';

export const CORE_VERSION = '1.0.0-phase2-iteration5';

